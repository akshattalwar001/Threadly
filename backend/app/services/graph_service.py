import json
import re

from neo4j import GraphDatabase

from app.config import (
    NEO4J_URI,
    NEO4J_USERNAME,
    NEO4J_PASSWORD,
)

driver = GraphDatabase.driver(
    NEO4J_URI,
    auth=(NEO4J_USERNAME, NEO4J_PASSWORD),
)


def slugify(name: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def initials_for(name: str) -> str:
    parts = [p for p in name.split() if p]
    return "".join(p[0].upper() for p in parts[:2]) or "?"


class GraphService:

    def _scanner_person(self, scanner_result):
        person = getattr(scanner_result, "person", scanner_result)
        meeting = getattr(scanner_result, "meeting", scanner_result)

        return person, meeting

    def find_existing_person(
        self,
        user_uid: str,
        scanner_result,
    ):
        person, _ = self._scanner_person(scanner_result)

        with driver.session() as session:

            result = session.run(
                """
                MATCH (me:User {firebaseUid:$user_uid})-[:KNOWS]->(p:Person)

                WHERE
                    toLower(p.name)=toLower($name)

                    OR (
                        $email IS NOT NULL
                        AND p.email=$email
                    )

                RETURN p
                LIMIT 1
                """,
                user_uid=user_uid,
                name=getattr(person, "name", None),
                email=getattr(person, "email", None),
            )

            return result.single()

    def create_person(
        self,
        user_uid: str,
        scanner_result,
    ):
        person, meeting = self._scanner_person(scanner_result)

        name = getattr(person, "name", None)
        role = getattr(person, "role", None)
        company = getattr(person, "company", None)
        email = getattr(person, "email", None)
        phone = getattr(person, "phone", None)
        event = getattr(meeting, "event", None)
        topics = list(getattr(meeting, "topics", []) or [])
        summary = getattr(meeting, "summary", "")
        commitments = list(getattr(meeting, "commitments", []) or [])

        existing = self.find_existing_person(
            user_uid,
            scanner_result,
        )

        if existing:
            return {
                "created": False,
                "duplicate": True,
                "person": existing["p"],
            }

        with driver.session() as session:

            session.run(
                """
                MATCH (me:User {firebaseUid:$user_uid})

                MERGE (p:Person {
                    name:$name
                })

                ON CREATE SET
                    p.id=$id,
                    p.role=$role,
                    p.title=$role,
                    p.company=$company,
                    p.email=$email,
                    p.phone=$phone,
                    p.initials=$initials,
                    p.met_at=$event,
                    p.met_date=date(),
                    p.last_contact="just now",
                    p.channel="card",
                    p.warmth=50,
                    p.signals=[],
                    p.last_crew="scan",
                    p.autonomy="yellow",
                    p.org_tags=[],
                    p.handles_json="{}",
                    p.createdAt=datetime()

                MERGE (me)-[r:KNOWS]->(p)

                ON CREATE SET
                    r.firstMet=datetime(),
                    r.lastContact=datetime(),
                    r.heatScore=100,
                    r.strength=100,
                    r.metVia=$event
                """,
                user_uid=user_uid,
                name=name,
                id=slugify(name),
                role=role,
                company=company,
                email=email,
                phone=phone,
                initials=initials_for(name),
                event=event,
            )

            # Event

            if event:

                session.run(
                    """
                    MATCH (p:Person {name:$name})

                    MERGE (e:Event {
                        name:$event
                    })

                    MERGE (p)-[:MET_AT]->(e)
                    """,
                    name=name,
                    event=event,
                )

            # Topics

            for topic in topics:

                session.run(
                    """
                    MATCH (p:Person {name:$name})

                    MERGE (t:Topic {
                        name:$topic
                    })

                    MERGE (p)-[:INTERESTED_IN {
                        strength:50
                    }]->(t)
                    """,
                    name=name,
                    topic=topic,
                )

            # Interaction

            session.run(
                """
                MATCH (me:User {firebaseUid:$user_uid})
                MATCH (p:Person {name:$name})

                CREATE (i:Interaction {
                    id:randomUUID(),
                    date:datetime(),
                    type:'first_meeting',
                    aiSummary:$summary,
                    commitments:$commitments
                })

                MERGE (me)-[:HAD]->(i)
                MERGE (p)-[:HAD]->(i)
                """,
                user_uid=user_uid,
                name=name,
                summary=summary,
                commitments=commitments,
            )

            self.recompute_warmth(user_uid)

            return {
                "created": True,
                "duplicate": False,
                "person": {
                    "name": name,
                    "company": company,
                },
            }

    def recompute_warmth(self, uid: str) -> int:
        """Recompute p.warmth for every person the user KNOWS, from real
        signals: how long ago they last had contact (decay), plus logged
        interactions and synced Telegram message counts (bonus). Replaces
        the old static warmth=50 default set at creation time.
        """

        with driver.session() as session:

            rows = session.run(
                """
                MATCH (u:User {firebaseUid:$uid})-[r:KNOWS]->(p:Person)

                OPTIONAL MATCH (p)-[:HAD]->(i:Interaction)

                WITH
                    p,
                    r,
                    count(i) + coalesce(p.telegram_message_count, 0) AS interactions

                RETURN
                    p.id AS id,
                    duration.between(
                        coalesce(r.lastContact, r.firstMet, p.createdAt, datetime()),
                        datetime()
                    ).days AS days_since_contact,
                    interactions AS interactions
                """,
                uid=uid,
            ).data()

            updates = []

            for row in rows:
                days_since = max(0, row["days_since_contact"] or 0)
                interactions = row["interactions"] or 0

                decay = min(60, days_since * 0.8)
                engagement_bonus = min(20, interactions * 4)

                warmth = round(
                    max(0, min(100, 50 - decay + engagement_bonus))
                )

                updates.append({"id": row["id"], "warmth": warmth})

            if updates:
                session.run(
                    """
                    UNWIND $updates AS u

                    MATCH (p:Person {id:u.id})

                    SET p.warmth = u.warmth
                    """,
                    updates=updates,
                )

            return len(updates)

    def get_people_by_event(
        self,
        user_uid: str,
        event: str,
    ):

        with driver.session() as session:

            result = session.run(
                """
                MATCH (u:User {firebaseUid:$uid})-[:KNOWS]->(p)

                MATCH (p)-[:MET_AT]->(e)

                WHERE toLower(e.name)
                CONTAINS toLower($event)

                RETURN
                    p.name AS name,
                    p.role AS role,
                    p.company AS company,
                    e.name AS event
                """,
                uid=user_uid,
                event=event,
            )

            return [r.data() for r in result]

    def get_people_by_topic(
        self,
        user_uid: str,
        topic: str,
    ):

        with driver.session() as session:

            result = session.run(
                """
                MATCH (u:User {firebaseUid:$uid})-[:KNOWS]->(p)

                MATCH (p)-[:INTERESTED_IN]->(t)

                WHERE toLower(t.name)
                CONTAINS toLower($topic)

                RETURN
                    p.name AS name,
                    p.role AS role,
                    p.company AS company,
                    collect(t.name) AS topics
                """,
                uid=user_uid,
                topic=topic,
            )

            return [r.data() for r in result]

    def get_people_by_company(
        self,
        user_uid: str,
        company: str,
    ):

        with driver.session() as session:

            result = session.run(
                """
                MATCH (u:User {firebaseUid:$uid})-[:KNOWS]->(p)

                WHERE
                    toLower(p.company)
                    CONTAINS toLower($company)

                RETURN
                    p.name AS name,
                    p.role AS role,
                    p.company AS company
                """,
                uid=user_uid,
                company=company,
            )

            return [r.data() for r in result]

    def get_people_by_name(
        self,
        user_uid: str,
        name: str,
    ):

        with driver.session() as session:

            result = session.run(
                """
                MATCH (u:User {firebaseUid:$uid})-[:KNOWS]->(p)

                WHERE
                    toLower(p.name)
                    CONTAINS toLower($name)

                RETURN
                    p.name AS name,
                    p.role AS role,
                    p.company AS company
                """,
                uid=user_uid,
                name=name,
            )

            return [r.data() for r in result]

    def get_ai_people(self, uid):

        with driver.session() as session:

            result = session.run(
                """
                MATCH (u:User {firebaseUid:$uid})-[:KNOWS]->(p)

                MATCH (p)-[:HAS_EXPERTISE]->(:Topic {name:"Artificial Intelligence"})

                RETURN
                    p.name AS name,
                    p.role AS role,
                    p.company AS company
                """,
                uid=uid,
            )

            return [r.data() for r in result]

    def get_founders(self, uid):

        with driver.session() as session:

            result = session.run(
                """
                MATCH (:User {firebaseUid:$uid})-[:KNOWS]->(p)

                WHERE toLower(p.role) CONTAINS "founder"

                RETURN
                    p.name AS name,
                    p.role AS role,
                    p.company AS company

                ORDER BY p.name
                """,
                uid=uid,
            )

            return [record.data() for record in result]

    def top_companies(self, uid):

        with driver.session() as session:

            result = session.run(
                """
                MATCH (:User {firebaseUid:$uid})-[:KNOWS]->(p)

                MATCH (p)-[:WORKS_AT]->(c)

                RETURN
                    c.name AS company,
                    count(*) AS people

                ORDER BY people DESC

                LIMIT 10
                """,
                uid=uid,
            )

            return [record.data() for record in result]
    
    def people_needing_followup(
        self,
        user_uid: str,
    ):

        with driver.session() as session:

            result = session.run(
                """
                MATCH (u:User {firebaseUid:$uid})

                MATCH (u)-[r:KNOWS]->(p)

                RETURN
                    p.name AS name,
                    p.company AS company,
                    toString(r.lastContact) AS lastContact,
                    r.heatScore AS heatScore
                ORDER BY r.lastContact ASC
                LIMIT 10
                """,
                uid=user_uid,
            )

            return [r.data() for r in result]

    def network_stats(self, uid):

        self.recompute_warmth(uid)

        with driver.session() as session:

            result = session.run(
                """
                MATCH (u:User {firebaseUid:$uid})

                OPTIONAL MATCH (u)-[:KNOWS]->(p)

                OPTIONAL MATCH (p)-[:MET_AT]->(e)

                OPTIONAL MATCH (p)-[:INTERESTED_IN]->(t)

                RETURN
                    count(DISTINCT p) AS people,
                    count(DISTINCT e) AS events,
                    count(DISTINCT t) AS topics
                """,
                uid=uid,
            )

            stats = result.single().data()

            health = session.run(
                """
                MATCH (u:User {firebaseUid:$uid})-[r:KNOWS]->(p:Person)

                WITH p, coalesce(p.warmth, r.heatScore, 50) AS warmth

                RETURN
                    count(p) AS total,
                    avg(warmth) AS avg_warmth,
                    sum(CASE WHEN warmth >= 55 THEN 1 ELSE 0 END) AS active
                """,
                uid=uid,
            ).single().data()

        stats["companies"] = self.total_companies(uid)
        stats["founders"] = self.total_founders(uid)
        stats["aiBuilders"] = self.total_ai_people(uid)

        total = health["total"] or 0

        if total == 0:
            stats["networkHealth"] = 50
        else:
            active_pct = 100 * (health["active"] or 0) / total
            stats["networkHealth"] = round(
                max(0, min(100, 0.6 * (health["avg_warmth"] or 0) + 0.4 * active_pct))
            )

        return stats

    def relationship_health(
        self,
        user_uid: str,
    ):
        with driver.session() as session:

            result = session.run(
                """
                MATCH (u:User {firebaseUid:$uid})-[r:KNOWS]->(p)

                RETURN
                    count(p) AS totalPeople,
                    avg(r.heatScore) AS averageWarmth,
                    min(r.lastContact) AS oldestContact
                """,
                uid=user_uid,
            )

            return result.single().data()

    def total_people(self, uid):

        with driver.session() as session:

            result = session.run(
                """
                MATCH (:User {firebaseUid:$uid})-[:KNOWS]->(p)

                RETURN count(p) AS total
                """,
                uid=uid,
            )

            return result.single()["total"]

    def total_companies(self, uid):

        with driver.session() as session:

            result = session.run(
                """
                MATCH (:User {firebaseUid:$uid})-[:KNOWS]->(:Person)-[:WORKS_AT]->(c)

                RETURN count(DISTINCT c) AS total
                """,
                uid=uid,
            )

            return result.single()["total"]

    def total_topics(self, uid):

        with driver.session() as session:

            result = session.run(
                """
                MATCH (:User {firebaseUid:$uid})-[:KNOWS]->(:Person)-[:HAS_EXPERTISE]->(t)

                RETURN count(DISTINCT t) AS total
                """,
                uid=uid,
            )

            return result.single()["total"]

    def total_founders(self, uid):

        with driver.session() as session:

            result = session.run(
                """
                MATCH (:User {firebaseUid:$uid})-[:KNOWS]->(p)

                WHERE toLower(coalesce(p.role, "")) CONTAINS "founder"

                RETURN count(p) AS total
                """,
                uid=uid,
            )

            return result.single()["total"]

    def total_ai_people(self, uid):

        with driver.session() as session:

            result = session.run(
                """
                MATCH (:User {firebaseUid:$uid})-[:KNOWS]->(p)

                MATCH (p)-[:HAS_EXPERTISE]->(:Topic {name:"Artificial Intelligence"})

                RETURN count(DISTINCT p) AS total
                """,
                uid=uid,
            )

            return result.single()["total"]

    def get_founders(self, uid):

        with driver.session() as session:

            result = session.run(
                """
                MATCH (:User {firebaseUid:$uid})-[:KNOWS]->(p)

                WHERE toLower(coalesce(p.role, "")) CONTAINS "founder"

                RETURN
                    p.name AS name,
                    p.role AS role,
                    p.company AS company
                ORDER BY p.company, p.name
                """,
                uid=uid,
            )

            return [r.data() for r in result]

    def top_companies(self, uid):

        with driver.session() as session:

            result = session.run(
                """
                MATCH (:User {firebaseUid:$uid})-[:KNOWS]->(p)

                WHERE p.company IS NOT NULL AND p.company <> ""

                RETURN
                    p.company AS company,
                    count(DISTINCT p) AS people
                ORDER BY people DESC, company ASC
                LIMIT 10
                """,
                uid=uid,
            )

            return [r.data() for r in result]

    # ─── Contacts (real replacement for fixtureContacts) ───────────────────

    def get_contacts(self, uid):

        self.recompute_warmth(uid)

        with driver.session() as session:

            result = session.run(
                """
                MATCH (u:User {firebaseUid:$uid})-[r:KNOWS]->(p:Person)

                RETURN
                    p.id AS id,
                    p.name AS name,
                    coalesce(p.title, p.role, "") AS title,
                    coalesce(p.company, "") AS company,
                    coalesce(p.initials, "") AS initials,
                    coalesce(p.met_at, "") AS met_at,
                    toString(p.met_date) AS met_date,
                    coalesce(p.last_contact, "") AS last_contact,
                    coalesce(p.channel, "email") AS channel,
                    coalesce(p.warmth, r.heatScore, 50) AS warmth,
                    coalesce(p.signals, []) AS signals,
                    coalesce(p.last_crew, "scan") AS last_crew,
                    coalesce(p.autonomy, "yellow") AS autonomy,
                    coalesce(p.org_tags, []) AS org_tags,
                    coalesce(p.handles_json, "{}") AS handles_json

                ORDER BY warmth DESC
                """,
                uid=uid,
            )

            contacts = [r.data() for r in result]

            for c in contacts:
                c["handles"] = json.loads(c.pop("handles_json") or "{}")

            return contacts

    def get_contact(self, uid, contact_id):

        self.recompute_warmth(uid)

        with driver.session() as session:

            result = session.run(
                """
                MATCH (u:User {firebaseUid:$uid})-[r:KNOWS]->(p:Person {id:$id})

                RETURN
                    p.id AS id,
                    p.name AS name,
                    coalesce(p.title, p.role, "") AS title,
                    coalesce(p.company, "") AS company,
                    coalesce(p.initials, "") AS initials,
                    coalesce(p.met_at, "") AS met_at,
                    toString(p.met_date) AS met_date,
                    coalesce(p.last_contact, "") AS last_contact,
                    coalesce(p.channel, "email") AS channel,
                    coalesce(p.warmth, r.heatScore, 50) AS warmth,
                    coalesce(p.signals, []) AS signals,
                    coalesce(p.last_crew, "scan") AS last_crew,
                    coalesce(p.autonomy, "yellow") AS autonomy,
                    coalesce(p.org_tags, []) AS org_tags,
                    coalesce(p.handles_json, "{}") AS handles_json,
                    coalesce(p.enrichment_json, "{}") AS enrichment_json
                """,
                uid=uid,
                id=contact_id,
            )

            record = result.single()

            if not record:
                return None

            contact = record.data()
            contact["handles"] = json.loads(contact.pop("handles_json") or "{}")
            contact["enrichment"] = json.loads(contact.pop("enrichment_json") or "{}") or None

            interactions = session.run(
                """
                MATCH (:Person {id:$id})-[:HAD_INTERACTION]->(i:Interaction)

                RETURN
                    i.id AS id,
                    toString(i.timestamp) AS timestamp,
                    coalesce(i.day_label, "") AS day_label,
                    i.channel AS channel,
                    i.direction AS direction,
                    i.kind AS kind,
                    i.preview AS preview,
                    i.crew AS crew

                ORDER BY i.timestamp DESC
                """,
                id=contact_id,
            )

            contact["interactions"] = [r.data() for r in interactions]

            timeline = session.run(
                """
                MATCH (:Person {id:$id})-[:WARMTH_POINT]->(w:WarmthPoint)

                RETURN
                    w.day AS day,
                    toString(w.date) AS date,
                    w.warmth AS warmth,
                    w.event AS event,
                    w.channel AS channel

                ORDER BY w.day ASC
                """,
                id=contact_id,
            )

            contact["warmth_timeline"] = [r.data() for r in timeline]

            return contact

    # ─── Drafts (Morning Connect queue) ─────────────────────────────────────

    def get_drafts(self, uid):

        with driver.session() as session:

            result = session.run(
                """
                MATCH (u:User {firebaseUid:$uid})-[:KNOWS]->(p:Person)-[:HAS_DRAFT]->(d:Draft)

                RETURN
                    d.id AS id,
                    p.id AS contact_id,
                    p.name AS contact,
                    coalesce(p.company, "") AS company,
                    coalesce(p.initials, "") AS initials,
                    d.crew AS crew,
                    d.channel AS channel,
                    coalesce(d.warmth, 50) AS warmth,
                    d.inbound_text AS inbound_text,
                    d.inbound_timestamp AS inbound_timestamp,
                    coalesce(d.signal_chips, []) AS signal_chips,
                    d.draft AS draft,
                    d.reasoning AS reasoning,
                    coalesce(d.reasoning_trail_json, "[]") AS reasoning_trail_json,
                    coalesce(d.status, "pending") AS status

                ORDER BY warmth DESC
                """,
                uid=uid,
            )

            drafts = [r.data() for r in result]

            for d in drafts:
                d["reasoning_trail"] = json.loads(d.pop("reasoning_trail_json") or "[]")

            return drafts

    # ─── Snap (cards in processing) ─────────────────────────────────────────

    def get_cards(self, uid):

        with driver.session() as session:

            result = session.run(
                """
                MATCH (u:User {firebaseUid:$uid})-[:HAS_CARD]->(c:Card)

                RETURN
                    c.id AS id,
                    c.state AS state,
                    c.filename AS filename,
                    toString(c.captured_at) AS captured_at,
                    coalesce(c.extracted_json, "{}") AS extracted_json,
                    c.error_reason AS error_reason

                ORDER BY c.captured_at DESC
                """,
                uid=uid,
            )

            cards = [r.data() for r in result]

            for c in cards:
                c["extracted"] = json.loads(c.pop("extracted_json") or "{}") or None

            return cards

    # ─── Scribe (voice notes) ───────────────────────────────────────────────

    def get_voice_notes(self, uid):

        with driver.session() as session:

            result = session.run(
                """
                MATCH (u:User {firebaseUid:$uid})-[:HAS_VOICE_NOTE]->(v:VoiceNote)

                RETURN
                    v.id AS id,
                    v.source AS source,
                    toString(v.date) AS date,
                    v.duration_sec AS duration_sec,
                    v.title AS title,
                    v.transcript_preview AS transcript_preview,
                    coalesce(v.commitments, []) AS commitments,
                    coalesce(v.contact_ids, []) AS contact_ids

                ORDER BY v.date DESC
                """,
                uid=uid,
            )

            return [r.data() for r in result]

    # ─── Dashboard activity feed ─────────────────────────────────────────────

    def get_activity(self, uid, limit=30):

        with driver.session() as session:

            result = session.run(
                """
                MATCH (u:User {firebaseUid:$uid})-[:HAS_ACTIVITY]->(a:ActivityEntry)

                RETURN
                    a.id AS id,
                    toString(a.timestamp) AS timestamp,
                    a.crew AS crew,
                    a.action AS action,
                    a.detail AS detail,
                    a.contact_id AS contact_id

                ORDER BY a.timestamp DESC
                LIMIT $limit
                """,
                uid=uid,
                limit=limit,
            )

            return [r.data() for r in result]

    # ─── Pulse (recently active contacts) ───────────────────────────────────

    def get_recently_active(self, uid, limit=10):

        self.recompute_warmth(uid)

        with driver.session() as session:

            result = session.run(
                """
                MATCH (u:User {firebaseUid:$uid})-[r:KNOWS]->(p:Person)

                WHERE r.lastContact IS NOT NULL

                RETURN
                    p.id AS id,
                    p.name AS name,
                    coalesce(p.title, p.role, "") AS title,
                    coalesce(p.company, "") AS company,
                    coalesce(p.initials, "") AS initials,
                    coalesce(p.channel, "email") AS channel,
                    toString(r.lastContact) AS last_contact,
                    coalesce(p.telegram_message_count, 0) AS telegram_message_count,
                    coalesce(p.warmth, r.heatScore, 50) AS warmth

                ORDER BY r.lastContact DESC
                LIMIT $limit
                """,
                uid=uid,
                limit=limit,
            )

            return [r.data() for r in result]

    # ─── Opportunities widget (reconnect candidates) ────────────────────────

    def get_opportunities(self, uid, limit=6):

        self.recompute_warmth(uid)

        with driver.session() as session:

            result = session.run(
                """
                MATCH (u:User {firebaseUid:$uid})-[r:KNOWS]->(p:Person)

                WITH p, coalesce(p.warmth, r.heatScore, 50) AS warmth

                WHERE warmth < 75

                RETURN
                    p.id AS id,
                    p.name AS name,
                    coalesce(p.title, p.role, "") AS title,
                    coalesce(p.company, "") AS company,
                    coalesce(p.initials, "") AS initials,
                    warmth AS warmth,
                    coalesce(p.last_contact, "") AS last_contact

                ORDER BY warmth ASC
                LIMIT $limit
                """,
                uid=uid,
                limit=limit,
            )

            return [r.data() for r in result]

    # ─── Relationship coverage widget (by org tag) ──────────────────────────

    def get_coverage(self, uid):

        with driver.session() as session:

            result = session.run(
                """
                MATCH (u:User {firebaseUid:$uid})-[:KNOWS]->(p:Person)

                WITH p, coalesce(p.org_tags, []) AS tags

                UNWIND (CASE WHEN size(tags) = 0 THEN ["Untagged"] ELSE tags END) AS tag

                RETURN tag AS label, count(*) AS count

                ORDER BY count DESC
                LIMIT 8
                """,
                uid=uid,
            )

            rows = [r.data() for r in result]
            total = sum(r["count"] for r in rows) or 1

            for r in rows:
                r["pct"] = round(100 * r["count"] / total)

            return rows

    # ─── Lead-o-meter analytics ──────────────────────────────────────────────

    def get_analytics(self, uid):

        self.recompute_warmth(uid)

        with driver.session() as session:

            summary = session.run(
                """
                MATCH (u:User {firebaseUid:$uid})-[r:KNOWS]->(p:Person)

                WITH p, coalesce(p.warmth, r.heatScore, 50) AS warmth

                RETURN
                    count(p) AS total_graph,
                    avg(warmth) AS avg_warmth,
                    sum(CASE WHEN warmth >= 55 THEN 1 ELSE 0 END) AS active_conversations,
                    sum(CASE WHEN warmth < 35 THEN 1 ELSE 0 END) AS dormant
                """,
                uid=uid,
            ).single().data()

            growth = session.run(
                """
                MATCH (u:User {firebaseUid:$uid})-[:KNOWS]->(p:Person)

                WHERE p.met_date IS NOT NULL

                WITH substring(toString(p.met_date), 0, 7) AS month, count(*) AS new_contacts

                RETURN month, new_contacts
                ORDER BY month ASC
                """,
                uid=uid,
            )

            growth_rows = [r.data() for r in growth]
            cumulative = 0
            for row in growth_rows:
                cumulative += row["new_contacts"]
                row["cumulative"] = cumulative

            channel_share = session.run(
                """
                MATCH (u:User {firebaseUid:$uid})-[:KNOWS]->(p:Person)

                WHERE p.channel IS NOT NULL

                RETURN p.channel AS channel, count(*) AS count
                ORDER BY count DESC
                """,
                uid=uid,
            )

            drafts_this_month = session.run(
                """
                MATCH (u:User {firebaseUid:$uid})-[:KNOWS]->(:Person)-[:HAS_DRAFT]->(d:Draft)

                RETURN
                    sum(CASE WHEN d.status = "approved" THEN 1 ELSE 0 END) AS sent,
                    count(d) AS staged
                """,
                uid=uid,
            ).single().data()

            top_active = session.run(
                """
                MATCH (u:User {firebaseUid:$uid})-[r:KNOWS]->(p:Person)

                WITH p, coalesce(p.warmth, r.heatScore, 50) AS warmth

                RETURN
                    p.id AS contact_id,
                    p.name AS name,
                    coalesce(p.company, "") AS company,
                    coalesce(p.initials, "") AS initials,
                    coalesce(p.channel, "email") AS channel,
                    warmth AS warmth,
                    coalesce(p.last_crew, "scan") AS last_crew

                ORDER BY warmth DESC
                LIMIT 30
                """,
                uid=uid,
            )

            return {
                "summary": {
                    "total_graph": summary["total_graph"] or 0,
                    "avg_warmth": round(summary["avg_warmth"] or 0, 1),
                    "active_conversations": summary["active_conversations"] or 0,
                    "dormant": summary["dormant"] or 0,
                    "drafts_sent_this_month": drafts_this_month["sent"] or 0,
                    "drafts_staged_this_month": drafts_this_month["staged"] or 0,
                },
                "growth": growth_rows,
                "channel_share": [r.data() for r in channel_share],
                "top_active": [r.data() for r in top_active],
            }


graph_service = GraphService()