import base64
import json

import requests
from cryptography.fernet import Fernet
from google.auth.transport.requests import Request as GoogleAuthRequest
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build

from app.config import (
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI,
    GOOGLE_TOKEN_KEY,
)
from app.database import get_driver
from app.services.graph_service import graph_service

_fernet = Fernet(GOOGLE_TOKEN_KEY)

# Read-only scopes only — Threadly never sends mail or edits contacts on the
# user's behalf, it only pulls signal into the graph.
SCOPES = [
    "https://www.googleapis.com/auth/contacts.readonly",
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/userinfo.email",
    "openid",
]


def _encrypt(value: str) -> str:
    return _fernet.encrypt(value.encode()).decode()


def _decrypt(value: str) -> str:
    return _fernet.decrypt(value.encode()).decode()


def _client_config() -> dict:
    return {
        "web": {
            "client_id": GOOGLE_CLIENT_ID,
            "client_secret": GOOGLE_CLIENT_SECRET,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [GOOGLE_REDIRECT_URI],
        }
    }


class GoogleService:

    def _new_flow(self) -> Flow:
        flow = Flow.from_client_config(_client_config(), scopes=SCOPES)
        flow.redirect_uri = GOOGLE_REDIRECT_URI
        return flow

    def auth_url(self, uid: str) -> str:
        flow = self._new_flow()

        # The uid rides in `state`, encrypted so it can't be tampered with
        # between the redirect to Google and the callback coming back.
        state = base64.urlsafe_b64encode(_encrypt(uid).encode()).decode()

        auth_url, _ = flow.authorization_url(
            access_type="offline",
            include_granted_scopes="true",
            prompt="consent",
            state=state,
        )

        return auth_url

    def handle_callback(self, code: str, state: str) -> str:
        try:
            uid = _decrypt(base64.urlsafe_b64decode(state.encode()).decode())
        except Exception:
            raise ValueError("Invalid or expired Google OAuth state.")

        flow = self._new_flow()
        flow.fetch_token(code=code)
        credentials = flow.credentials

        email = None
        try:
            oauth2 = build("oauth2", "v2", credentials=credentials)
            email = oauth2.userinfo().get().execute().get("email")
        except Exception:
            pass

        self._save_credentials(uid, credentials, email)

        return uid

    def _save_credentials(self, uid: str, credentials: Credentials, email: str | None) -> None:
        driver = get_driver()

        with driver.session() as db:
            db.run(
                """
                MATCH (u:User {firebaseUid:$uid})

                SET
                    u.google_credentials_enc=$credentials_enc,
                    u.google_connected_at=datetime()

                SET u.google_email = coalesce($email, u.google_email)
                """,
                uid=uid,
                credentials_enc=_encrypt(credentials.to_json()),
                email=email,
            )

    def _load_credentials(self, uid: str) -> Credentials | None:
        driver = get_driver()

        with driver.session() as db:
            record = db.run(
                """
                MATCH (u:User {firebaseUid:$uid})
                RETURN u.google_credentials_enc AS credentials_enc
                """,
                uid=uid,
            ).single()

        if not record or not record["credentials_enc"]:
            return None

        info = json.loads(_decrypt(record["credentials_enc"]))
        credentials = Credentials.from_authorized_user_info(info, SCOPES)

        if credentials.expired and credentials.refresh_token:
            credentials.refresh(GoogleAuthRequest())
            self._save_credentials(uid, credentials, None)

        return credentials

    def status(self, uid: str) -> dict:
        driver = get_driver()

        with driver.session() as db:
            record = db.run(
                """
                MATCH (u:User {firebaseUid:$uid})
                RETURN
                    u.google_credentials_enc IS NOT NULL AS connected,
                    u.google_email AS email,
                    toString(u.google_connected_at) AS connected_at
                """,
                uid=uid,
            ).single()

        if not record:
            return {"connected": False}

        return {
            "connected": bool(record["connected"]),
            "email": record["email"],
            "connected_at": record["connected_at"],
        }

    def disconnect(self, uid: str) -> None:
        credentials = self._load_credentials(uid)

        if credentials:
            try:
                requests.post(
                    "https://oauth2.googleapis.com/revoke",
                    params={"token": credentials.refresh_token or credentials.token},
                    headers={"content-type": "application/x-www-form-urlencoded"},
                    timeout=10,
                )
            except Exception:
                pass

        driver = get_driver()

        with driver.session() as db:
            db.run(
                """
                MATCH (u:User {firebaseUid:$uid})
                REMOVE
                    u.google_credentials_enc,
                    u.google_email,
                    u.google_connected_at
                """,
                uid=uid,
            )

    def list_contact_groups(self, uid: str) -> list[dict]:
        credentials = self._load_credentials(uid)

        if not credentials:
            raise ValueError("Google is not connected for this user.")

        people_service = build("people", "v1", credentials=credentials)

        # Google classifies its built-in labels (Family, Friends, Coworkers,
        # Starred) as SYSTEM_CONTACT_GROUP alongside the true catch-alls
        # (My Contacts / All Contacts / Chat contacts / Blocked). Only the
        # catch-alls should be hidden here — the rest are real, user-assignable
        # labels and are exactly what someone organizing contacts in the
        # mobile app would pick.
        CATCH_ALL_GROUPS = {"myContacts", "all", "chatBuddies", "blocked"}

        groups: list[dict] = []
        page_token = None

        while True:
            response = (
                people_service.contactGroups()
                .list(pageSize=200, pageToken=page_token)
                .execute()
            )

            for group in response.get("contactGroups", []):
                if group.get("name") in CATCH_ALL_GROUPS:
                    continue

                groups.append(
                    {
                        "resource_name": group["resourceName"],
                        "name": group.get("formattedName") or group.get("name"),
                        "member_count": group.get("memberCount", 0),
                    }
                )

            page_token = response.get("nextPageToken")
            if not page_token:
                break

        return groups

    def sync_contacts(self, uid: str, group_resource_names: list[str]) -> dict:
        if not group_resource_names:
            raise ValueError(
                "Select at least one Google Contacts group to sync — "
                "syncing your entire address book is not supported."
            )

        credentials = self._load_credentials(uid)

        if not credentials:
            raise ValueError("Google is not connected for this user.")

        people_service = build("people", "v1", credentials=credentials)
        gmail_service = build("gmail", "v1", credentials=credentials)

        allowed_groups = set(group_resource_names)
        people: list[dict] = []
        page_token = None

        while True:
            response = (
                people_service.people()
                .connections()
                .list(
                    resourceName="people/me",
                    pageSize=1000,
                    personFields="names,emailAddresses,phoneNumbers,memberships",
                    pageToken=page_token,
                )
                .execute()
            )

            for connection in response.get("connections", []):
                memberships = connection.get("memberships") or []
                group_ids = {
                    m["contactGroupMembership"]["contactGroupResourceName"]
                    for m in memberships
                    if "contactGroupMembership" in m
                }

                if not group_ids & allowed_groups:
                    continue

                names = connection.get("names") or []
                emails = connection.get("emailAddresses") or []
                phones = connection.get("phoneNumbers") or []

                if not names and not emails:
                    continue

                name = names[0]["displayName"] if names else emails[0]["value"]
                email = emails[0]["value"] if emails else None

                signal = (
                    self._gmail_signal(gmail_service, email) if email else {}
                )

                people.append(
                    {
                        "resource_name": connection["resourceName"],
                        "name": name,
                        "email": email,
                        "phone": phones[0]["value"] if phones else None,
                        "message_count": signal.get("message_count", 0),
                        "last_message_date": signal.get("last_message_date"),
                    }
                )

            page_token = response.get("nextPageToken")
            if not page_token:
                break

        created = self._upsert_people(uid, people)

        return {"synced": len(people), "created": created}

    def _gmail_signal(self, gmail_service, email: str) -> dict:
        try:
            response = (
                gmail_service.users()
                .messages()
                .list(
                    userId="me",
                    q=f"from:{email} OR to:{email}",
                    maxResults=1,
                )
                .execute()
            )
        except Exception:
            return {"message_count": 0, "last_message_date": None}

        message_count = response.get("resultSizeEstimate", 0)
        messages = response.get("messages") or []

        last_message_date = None
        if messages:
            try:
                detail = (
                    gmail_service.users()
                    .messages()
                    .get(
                        userId="me",
                        id=messages[0]["id"],
                        format="metadata",
                        metadataHeaders=["Date"],
                    )
                    .execute()
                )
                internal_date_ms = int(detail.get("internalDate", 0))
                if internal_date_ms:
                    last_message_date = internal_date_ms / 1000
            except Exception:
                pass

        return {"message_count": message_count, "last_message_date": last_message_date}

    def _upsert_people(self, uid: str, people: list[dict]) -> int:
        if not people:
            return 0

        driver = get_driver()
        created = 0

        with driver.session() as db:
            for person in people:
                record = db.run(
                    """
                    MATCH (me:User {firebaseUid:$uid})

                    MERGE (p:Person {google_id:$google_id})

                    ON CREATE SET
                        p.id=$id,
                        p.name=$name,
                        p.email=$email,
                        p.phone=$phone,
                        p.initials=$initials,
                        p.channel="google",
                        p.warmth=50,
                        p.signals=[],
                        p.last_crew="google_sync",
                        p.autonomy="yellow",
                        p.org_tags=[],
                        p.handles_json=$handles_json,
                        p.google_message_count=$message_count,
                        p.createdAt=datetime()

                    ON MATCH SET
                        p.email=coalesce($email, p.email),
                        p.handles_json=$handles_json,
                        p.google_message_count=$message_count

                    MERGE (me)-[r:KNOWS]->(p)

                    ON CREATE SET
                        r.firstMet=datetime(),
                        r.lastContact=coalesce($last_message_date, datetime()),
                        r.heatScore=50,
                        r.strength=50,
                        r.metVia="google"

                    ON MATCH SET
                        r.lastContact=coalesce($last_message_date, r.lastContact)

                    RETURN r.firstMet = r.lastContact AS was_created
                    """,
                    uid=uid,
                    google_id=person["resource_name"],
                    id=f"g-{person['resource_name']}",
                    name=person["name"],
                    email=person.get("email"),
                    phone=person.get("phone"),
                    initials="".join(
                        w[0].upper() for w in person["name"].split()[:2]
                    )
                    or "?",
                    handles_json=json.dumps({"email": person.get("email")}),
                    message_count=person.get("message_count", 0),
                    last_message_date=person.get("last_message_date"),
                ).single()

                if record and record["was_created"]:
                    created += 1

        graph_service.recompute_warmth(uid)

        return created


google_service = GoogleService()
