import json

from cryptography.fernet import Fernet
from telethon import TelegramClient
from telethon.errors import (
    PhoneCodeInvalidError,
    PhoneCodeExpiredError,
    SessionPasswordNeededError,
)
from telethon.sessions import StringSession
from telethon.tl.functions.contacts import GetContactsRequest

from app.config import (
    TELEGRAM_API_ID,
    TELEGRAM_API_HASH,
    TELEGRAM_SESSION_KEY,
)
from app.database import get_driver
from app.services.graph_service import graph_service

_fernet = Fernet(TELEGRAM_SESSION_KEY)

# Pending logins (phone submitted, code not yet verified) live only in
# memory for the lifetime of the login flow. Keyed by Firebase uid.
# NOTE: this assumes a single backend worker process. If the API is ever
# run with multiple workers/replicas, this must move to a shared store.
_pending_clients: dict[str, TelegramClient] = {}
_pending_phone_hash: dict[str, str] = {}


def _encrypt(value: str) -> str:
    return _fernet.encrypt(value.encode()).decode()


def _decrypt(value: str) -> str:
    return _fernet.decrypt(value.encode()).decode()


class TelegramService:

    def _new_client(self, session_str: str = "") -> TelegramClient:
        return TelegramClient(
            StringSession(session_str),
            int(TELEGRAM_API_ID),
            TELEGRAM_API_HASH,
        )

    async def start_login(self, uid: str, phone: str) -> None:
        old = _pending_clients.pop(uid, None)
        if old:
            await old.disconnect()

        client = self._new_client()
        await client.connect()

        sent = await client.send_code_request(phone)

        _pending_clients[uid] = client
        _pending_phone_hash[uid] = sent.phone_code_hash

    async def verify_login(
        self,
        uid: str,
        phone: str,
        code: str,
        password: str | None = None,
    ) -> dict:
        client = _pending_clients.get(uid)
        phone_code_hash = _pending_phone_hash.get(uid)

        if not client or not phone_code_hash:
            raise ValueError("No pending Telegram login for this user. Start over.")

        try:
            try:
                await client.sign_in(
                    phone=phone,
                    code=code,
                    phone_code_hash=phone_code_hash,
                )
            except SessionPasswordNeededError:
                if not password:
                    return {"needs_password": True}
                await client.sign_in(password=password)

            session_str = client.session.save()
            me = await client.get_me()

            self._save_session(uid, session_str, phone)

            return {
                "connected": True,
                "telegram_user_id": me.id,
                "username": me.username,
            }
        except (PhoneCodeInvalidError, PhoneCodeExpiredError) as e:
            raise ValueError(str(e))
        finally:
            await client.disconnect()
            _pending_clients.pop(uid, None)
            _pending_phone_hash.pop(uid, None)

    def _save_session(self, uid: str, session_str: str, phone: str) -> None:
        driver = get_driver()

        with driver.session() as db:
            db.run(
                """
                MATCH (u:User {firebaseUid:$uid})

                SET
                    u.telegram_session_enc=$session_enc,
                    u.telegram_phone=$phone,
                    u.telegram_connected_at=datetime()
                """,
                uid=uid,
                session_enc=_encrypt(session_str),
                phone=phone,
            )

    def _load_session(self, uid: str) -> str | None:
        driver = get_driver()

        with driver.session() as db:
            record = db.run(
                """
                MATCH (u:User {firebaseUid:$uid})
                RETURN u.telegram_session_enc AS session_enc
                """,
                uid=uid,
            ).single()

        if not record or not record["session_enc"]:
            return None

        return _decrypt(record["session_enc"])

    def status(self, uid: str) -> dict:
        driver = get_driver()

        with driver.session() as db:
            record = db.run(
                """
                MATCH (u:User {firebaseUid:$uid})
                RETURN
                    u.telegram_session_enc IS NOT NULL AS connected,
                    u.telegram_phone AS phone,
                    toString(u.telegram_connected_at) AS connected_at
                """,
                uid=uid,
            ).single()

        if not record:
            return {"connected": False}

        return {
            "connected": bool(record["connected"]),
            "phone": record["phone"],
            "connected_at": record["connected_at"],
        }

    async def disconnect(self, uid: str) -> None:
        session_str = self._load_session(uid)

        if session_str:
            client = self._new_client(session_str)
            try:
                await client.connect()
                await client.log_out()
            except Exception:
                pass
            finally:
                await client.disconnect()

        driver = get_driver()

        with driver.session() as db:
            db.run(
                """
                MATCH (u:User {firebaseUid:$uid})
                REMOVE
                    u.telegram_session_enc,
                    u.telegram_phone,
                    u.telegram_connected_at
                """,
                uid=uid,
            )

    async def sync_contacts(self, uid: str) -> dict:
        session_str = self._load_session(uid)

        if not session_str:
            raise ValueError("Telegram is not connected for this user.")

        client = self._new_client(session_str)
        await client.connect()

        try:
            people_by_id: dict[int, dict] = {}

            TELEGRAM_SYSTEM_ACCOUNT_ID = 777000

            def add_user(user, signal: dict | None = None) -> None:
                if (
                    user is None
                    or user.bot
                    or user.deleted
                    or user.is_self
                    or user.id == TELEGRAM_SYSTEM_ACCOUNT_ID
                ):
                    return

                name = " ".join(
                    filter(None, [user.first_name, user.last_name])
                ).strip() or user.username or str(user.id)

                entry = people_by_id.setdefault(
                    user.id,
                    {
                        "telegram_id": user.id,
                        "message_count": 0,
                        "last_message_date": None,
                    },
                )

                entry["name"] = name
                entry["username"] = user.username
                entry["phone"] = user.phone

                if signal:
                    entry["message_count"] = signal.get("message_count", 0)
                    entry["last_message_date"] = signal.get("last_message_date")

            # Explicitly saved contacts (no message history available here)
            result = await client(GetContactsRequest(hash=0))
            for user in result.users:
                add_user(user)

            # Recent one-on-one chat partners — this is where the real
            # engagement signal (message count, recency) comes from.
            async for dialog in client.iter_dialogs():
                if not dialog.is_user:
                    continue

                signal = {
                    "last_message_date": dialog.message.date if dialog.message else None,
                }

                try:
                    recent = await client.get_messages(dialog.entity, limit=1)
                    signal["message_count"] = recent.total or 0
                except Exception:
                    signal["message_count"] = 0

                add_user(dialog.entity, signal)

            people = list(people_by_id.values())
        finally:
            await client.disconnect()

        created = self._upsert_people(uid, people)

        return {"synced": len(people), "created": created}

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

                    MERGE (p:Person {telegram_id:$telegram_id})

                    ON CREATE SET
                        p.id=$id,
                        p.name=$name,
                        p.phone=$phone,
                        p.initials=$initials,
                        p.channel="telegram",
                        p.warmth=50,
                        p.signals=[],
                        p.last_crew="telegram_sync",
                        p.autonomy="yellow",
                        p.org_tags=[],
                        p.handles_json=$handles_json,
                        p.telegram_message_count=$message_count,
                        p.createdAt=datetime()

                    ON MATCH SET
                        p.handles_json=$handles_json,
                        p.telegram_message_count=$message_count

                    MERGE (me)-[r:KNOWS]->(p)

                    ON CREATE SET
                        r.firstMet=datetime(),
                        r.lastContact=coalesce($last_message_date, datetime()),
                        r.heatScore=50,
                        r.strength=50,
                        r.metVia="telegram"

                    ON MATCH SET
                        r.lastContact=coalesce($last_message_date, r.lastContact)

                    RETURN r.firstMet = r.lastContact AS was_created
                    """,
                    uid=uid,
                    telegram_id=person["telegram_id"],
                    id=f"tg-{person['telegram_id']}",
                    name=person["name"],
                    phone=person.get("phone"),
                    initials="".join(
                        w[0].upper() for w in person["name"].split()[:2]
                    )
                    or "?",
                    handles_json=json.dumps(
                        {"telegram": person.get("username")}
                    ),
                    message_count=person.get("message_count", 0),
                    last_message_date=person.get("last_message_date"),
                ).single()

                if record and record["was_created"]:
                    created += 1

        graph_service.recompute_warmth(uid)

        return created


telegram_service = TelegramService()
