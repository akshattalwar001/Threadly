"""
One-off script to seed sample relationship data into Neo4j for a real user,
so the dashboard has real data to render instead of empty/zero results.

Usage:
    python seed_data.py <your-login-email>

Safe to re-run: everything is MERGEd on a stable id, not CREATEd blindly.
"""

import json
import sys
from datetime import datetime, timedelta

from app.firebase import firebase_auth
from app.services.graph_service import driver, slugify, initials_for


PEOPLE = [
    dict(name="Sofia Alencar", title="Head of Partnerships", company="Helix Tech",
         met_at="TOKEN2049 Singapore", met_date="2025-09-19", last_contact="2h",
         channel="telegram", warmth=82, signals=["Hi!!", "🔥", "2-min reply", "voice note"],
         last_crew="signals", autonomy="yellow", org_tags=["Web3 SG", "TOKEN2049"],
         handles={"telegram": "@sofia_alencar", "linkedin": "/in/sofia-alencar-helix", "email": "sofia@helix.tech"}),
    dict(name="Priya Raghavan", title="Partner", company="Sequoia SEA",
         met_at="TOKEN2049 Singapore", met_date="2025-09-20", last_contact="6h",
         channel="telegram", warmth=86, signals=["Hi!!", "🔥", "2-min reply"],
         last_crew="signals", autonomy="yellow", org_tags=["ABA", "TOKEN2049"],
         handles={"telegram": "@priya_raghavan", "linkedin": "/in/priya-raghavan"}),
    dict(name="Marcus Low", title="Founder & CEO", company="Kite Commerce",
         met_at="Claude Code SG", met_date="2026-04-10", last_contact="18h",
         channel="telegram", warmth=88, signals=["Hi!!", "weekend voice notes", "1-min reply"],
         last_crew="signals", autonomy="green", org_tags=["Claude Code SG", "Web3 SG"],
         handles={"telegram": "@marcuslow", "linkedin": "/in/marcuslow"}),
    dict(name="Akiko Fujimoto", title="Director, International Div.", company="METI Japan",
         met_at="Tokyo partnership visit", met_date="2025-11-14", last_contact="3d",
         channel="email", warmth=77, signals=["formal reliable", "within 4hr"],
         last_crew="scribe", autonomy="yellow", org_tags=["ABA", "METI"],
         handles={"email": "a.fujimoto@meti.go.jp"}),
    dict(name="Diego Alvarez", title="GM, LATAM", company="Grupo Santander",
         met_at="Web3 SG talk", met_date="2026-02-06", last_contact="5d",
         channel="email", warmth=76, signals=["fast replies", "emoji-heavy"],
         last_crew="inbound", autonomy="yellow", org_tags=["Web3 SG"],
         handles={"email": "diego.alvarez@santander.com", "linkedin": "/in/diego-alvarez-santander"}),
    dict(name="Theo Kostas", title="VP Partnerships", company="Polygon",
         met_at="ETHSG 2026", met_date="2026-01-29", last_contact="1d",
         channel="telegram", warmth=70, signals=["Aussie casual", "reliable"],
         last_crew="signals", autonomy="yellow", org_tags=["Web3 SG"],
         handles={"telegram": "@theo_polygon"}),
    dict(name="Sam Harel", title="Partner", company="Y Combinator",
         met_at="YC SEA demo day", met_date="2026-03-04", last_contact="2d",
         channel="email", warmth=72, signals=["one emoji per msg", "within 24hr"],
         last_crew="inbound", autonomy="yellow", org_tags=["YC network"],
         handles={"email": "sam@ycombinator.com"}),
    dict(name="Kai Jensen", title="Partnerships", company="Seedstars SEA",
         met_at="Instagram DM", met_date="2026-03-18", last_contact="4d",
         channel="social", warmth=68, signals=["🙌", "quick reply"],
         last_crew="social", autonomy="yellow", org_tags=["Web3 SG"],
         handles={"linkedin": "/in/kai-jensen-seedstars"}),
    dict(name="Naomi Park", title="Reporter", company="Blockworks",
         met_at="TOKEN2049 write-up", met_date="2025-09-24", last_contact="6d",
         channel="social", warmth=58, signals=["journalist", "X DM"],
         last_crew="social", autonomy="yellow", org_tags=["TOKEN2049"],
         handles={"linkedin": "/in/naomi-park-blockworks"}),
    dict(name="Catherine Liu", title="Senior researcher", company="METI Japan",
         met_at="Intro via Akio", met_date="2025-12-02", last_contact="8d",
         channel="email", warmth=68, signals=["warm intro", "thoughtful"],
         last_crew="scribe", autonomy="yellow", org_tags=["METI", "ABA"],
         handles={"email": "c.liu@meti.go.jp"}),
    dict(name="Leila Okonkwo", title="BD Lead", company="Chainalysis APAC",
         met_at="Compliance Summit 2026", met_date="2026-03-12", last_contact="6d",
         channel="email", warmth=66, signals=["polite", "within a day"],
         last_crew="inbound", autonomy="yellow", org_tags=["Web3 SG"],
         handles={"linkedin": "/in/leila-okonkwo"}),
    dict(name="Akio Tanaka", title="Director", company="METI Japan",
         met_at="Web3 SG dinner", met_date="2026-04-12", last_contact="11d",
         channel="email", warmth=62, signals=["4-hr reply", "formal"],
         last_crew="scribe", autonomy="yellow", org_tags=["METI", "ABA"],
         handles={"email": "a.tanaka@meti.go.jp"}),
    dict(name="Yuki Matsuda", title="Creative director", company="Freelance",
         met_at="Hungry Hamster launch", met_date="2026-02-08", last_contact="9d",
         channel="email", warmth=58, signals=["helpful", "within a day"],
         last_crew="inbound", autonomy="yellow", org_tags=["Hungry Hamster"],
         handles={"email": "yuki.matsuda@gmail.com"}),
    dict(name="Rina Patel", title="Head of Events", company="TOKEN2049",
         met_at="TOKEN2049 organisers' dinner", met_date="2025-09-18", last_contact="14d",
         channel="email", warmth=54, signals=["transactional", "calendar-driven"],
         last_crew="inbound", autonomy="yellow", org_tags=["TOKEN2049"],
         handles={"email": "rina@token2049.com"}),
    dict(name="Ben Turnbull", title="Associate", company="a16z crypto",
         met_at="SF intro", met_date="2025-10-22", last_contact="22d",
         channel="email", warmth=52, signals=["measured", "business hours"],
         last_crew="inbound", autonomy="yellow", org_tags=["Web3 SG"],
         handles={"linkedin": "/in/ben-turnbull-a16z"}),
    dict(name="Zhang Yu", title="Founder", company="Mercury Labs",
         met_at="Shanghai meetup", met_date="2025-12-11", last_contact="31d",
         channel="telegram", warmth=50, signals=["declining", "short replies"],
         last_crew="signals", autonomy="yellow", org_tags=["Web3 SG"],
         handles={"telegram": "@zhang_mercury"}),
    dict(name="Oluwaseun Adebayo", title="Partner", company="Africa Blockchain Fund",
         met_at="Warm intro via Marcus", met_date="2026-01-15", last_contact="17d",
         channel="email", warmth=48, signals=["warm intro", "paced"],
         last_crew="inbound", autonomy="yellow", org_tags=["Web3 SG"],
         handles={}),
    dict(name="Kenji Nakamura", title="Director, Innovation Hub", company="MUFG Innovation Hub",
         met_at="Tokyo fintech roundtable", met_date="2025-10-30", last_contact="40d",
         channel="email", warmth=22, signals=["cold", "no reply in weeks"],
         last_crew="inbound", autonomy="yellow", org_tags=["METI"],
         handles={"linkedin": "/in/kenji-nakamura-mufg"}),
]

INTERACTIONS = {
    "sofia": [
        dict(timestamp="2026-04-23T10:42:00", day_label="Today", channel="telegram",
             direction="inbound", kind="message", crew="signals",
             preview="Hi Freddy!! Loved your talk at TOKEN. Let's grab coffee this week?? 🔥"),
        dict(timestamp="2026-04-09T20:47:00", day_label="Thu 9 April", channel="telegram",
             direction="inbound", kind="voice_note", crew="scribe",
             preview="[voice note · 1m 04s · Sofia on Helix's privacy stack]"),
        dict(timestamp="2025-09-19T15:20:00", day_label="TOKEN2049 · Sep 2025", channel="card",
             direction="inbound", kind="card_scan", crew="scan",
             preview="Business card scanned · Helix Tech · Head of Partnerships"),
    ],
    "priya": [
        dict(timestamp="2026-04-22T09:14:00", day_label="Yesterday", channel="telegram",
             direction="inbound", kind="message", crew="signals",
             preview="Hi!! Fred — amazing to reconnect. Let me know when you're free this week?"),
    ],
    "marcus": [
        dict(timestamp="2026-04-22T07:30:00", day_label="Yesterday", channel="telegram",
             direction="inbound", kind="voice_note", crew="scribe",
             preview="[voice note · 10m 22s · Kite escrow redesign]"),
    ],
}

ENRICHMENTS = {
    "sofia": dict(
        linkedin_url="https://linkedin.com/in/sofia-alencar-helix",
        linkedin_summary="Head of Partnerships at Helix Tech since Aug 2024. Focus: privacy-preserving compliance infrastructure for SEA fintech.",
        company_url="https://helix.tech",
        company_summary="Helix Tech · Series A $18M (Sequoia SEA lead, Feb 2025). Team of 28 across Singapore, Jakarta, Manila.",
        mutual_connections=[{"name": "Marcus Low", "contact_id": "marcus-low"}, {"name": "Priya Raghavan", "contact_id": "priya-raghavan"}],
        recent_news=[{"title": "Helix Tech closes $18M Series A led by Sequoia SEA", "date": "Feb 2025"}],
        location="Singapore",
        sourced_from=["Crunchbase", "helix.tech", "TechInAsia"],
        last_refreshed="2026-04-22T14:30:00",
    ),
    "marcus": dict(
        linkedin_url="https://linkedin.com/in/marcuslow",
        linkedin_summary="Founder & CEO at Kite Commerce. Previously Head of Product at Shopee SEA.",
        company_url="https://kitecommerce.io",
        company_summary="Kite Commerce · Seed $4.5M. Cross-border escrow and commerce infrastructure for SEA SMBs.",
        mutual_connections=[{"name": "Sofia Alencar", "contact_id": "sofia-alencar"}],
        recent_news=[{"title": "Kite Commerce launches cross-border escrow pilot", "date": "Mar 2026"}],
        location="Singapore",
        sourced_from=["Crunchbase", "kitecommerce.io"],
        last_refreshed="2026-04-12T11:05:00",
    ),
}

WARMTH_TIMELINE = {
    "sofia": [
        dict(day=0, date="2026-01-23", warmth=62, event="Baseline · post-TOKEN2049 warm lead", channel=None),
        dict(day=28, date="2026-02-20", warmth=48, event="Drift flagged by Messenger", channel=None),
        dict(day=54, date="2026-03-18", warmth=40, event="Flagged for resurrection", channel=None),
        dict(day=56, date="2026-03-20", warmth=68, event="Reconnected at SGInnovate dinner", channel="telegram"),
        dict(day=90, date="2026-04-23", warmth=82, event="Today · draft staged for Morning Connect", channel=None),
    ],
}

DRAFTS = [
    dict(contact="sofia", crew="signals", channel="Telegram", warmth=82,
         inbound_text="Hi Freddy!! Loved your talk at TOKEN. Let's grab coffee this week?? 🔥",
         inbound_timestamp="10:42", signal_chips=["Hi!!", "🔥", "2-min reply"],
         draft="Sofia — so good to hear from you! Thursday 3pm works for me, or I can come to your side of town.",
         reasoning="Met 14 hours ago at a flagged event. Warmth 82 (hot). Thursday 3pm is free on your calendar.",
         reasoning_trail=[{"crew": "signals", "note": "Hi!! + 🔥 + 2-min reply → hot"}],
         status="pending"),
    dict(contact="priya", crew="signals", channel="Telegram", warmth=86,
         inbound_text="Hi!! Fred — amazing to reconnect. Let me know when you're free this week?",
         inbound_timestamp="09:14", signal_chips=["Hi!!", "2-min reply"],
         draft="Priya! Great to hear from you — Wed or Thu afternoon both work, your call.",
         reasoning="Fast reply pattern historically. Warmth 86.",
         reasoning_trail=[{"crew": "signals", "note": "Consistently 2-min replies → hot"}],
         status="pending"),
    dict(contact="diego", crew="inbound", channel="Gmail", warmth=76,
         inbound_text="Hi Fred!! Any update on the LATAM pilot?",
         inbound_timestamp="Yesterday", signal_chips=["fast reply", "emoji-heavy"],
         draft="Diego — pilot's moving, will have concrete numbers by Friday.",
         reasoning="Warm lead, needs a timeline update.",
         reasoning_trail=[{"crew": "inbound", "note": "Cold ask qualified as warm"}],
         status="approved"),
    dict(contact="akiko", crew="scribe", channel="Gmail", warmth=77,
         inbound_text="Following up on the Tokyo partnership deck.",
         inbound_timestamp="3d ago", signal_chips=["formal", "reliable"],
         draft="Akiko-san, apologies for the delay — deck attached, happy to walk through it live.",
         reasoning="Formal tone matched, overdue reply.",
         reasoning_trail=[{"crew": "scribe", "note": "Formal register detected"}],
         status="pending"),
    dict(contact="theo", crew="signals", channel="Telegram", warmth=70,
         inbound_text="Hey mate, still keen to catch up re: Polygon partnerships?",
         inbound_timestamp="1d ago", signal_chips=["Aussie casual"],
         draft="Theo — yes! How's next Tuesday for a call?",
         reasoning="Casual tone, reliable responder.",
         reasoning_trail=[{"crew": "signals", "note": "Casual register matched"}],
         status="pending"),
]

VOICE_NOTES = [
    dict(source="plaud", date="2026-04-22", duration_sec=1080,
         title="Catherine Liu · SEA regulatory framework chat",
         transcript_preview="Catherine walked through the upcoming SEA regulatory framework METI is drafting...",
         commitments=["Send Catherine the SEA reg deck", "Intro Catherine x Marcus Low"],
         contact_ids=["catherine-liu", "marcus-low"]),
    dict(source="plaud", date="2026-04-20", duration_sec=240,
         title="Sofia Alencar · voice note reply",
         transcript_preview="Hey Fred, just thinking through your question about the Helix privacy stack...",
         commitments=["Whiteboard session with Sofia (week of Apr 23)"],
         contact_ids=["sofia-alencar"]),
    dict(source="meeting", date="2026-04-18", duration_sec=2760,
         title="ABA EXCO weekly · 46 min",
         transcript_preview="Standing EXCO agenda. Updates from the Tokyo delegation, TOKEN Dubai prep...",
         commitments=["Draft Q3 partnership deck by end of week", "Follow up with Akiko on METI sponsors"],
         contact_ids=["akio-tanaka", "akiko-fujimoto"]),
]

CARDS = [
    dict(state="complete", filename="img_2026-04-23_0931.jpg", captured_at="2026-04-23T09:31:00",
         extracted={"name": "Marcus Low", "title": "Founder & CEO", "company": "Kite Commerce"}),
    dict(state="enriching", filename="img_2026-04-23_0940.jpg", captured_at="2026-04-23T09:40:00",
         extracted={"name": "Theo Kostas", "company": "Polygon"}),
    dict(state="error", filename="img_2026-04-22_1802.jpg", captured_at="2026-04-22T18:02:00",
         error_reason="Blurry image — could not read text"),
]

ACTIVITY = [
    dict(timestamp="2026-04-23T10:42:00", crew="signals", action="Drafted reply", detail="Sofia Alencar · Telegram", contact_id="sofia-alencar"),
    dict(timestamp="2026-04-23T09:31:00", crew="scan", action="Card scanned", detail="Marcus Low · Kite Commerce", contact_id="marcus-low"),
    dict(timestamp="2026-04-22T20:15:00", crew="scribe", action="Voice note transcribed", detail="Catherine Liu · SEA regulatory chat", contact_id="catherine-liu"),
    dict(timestamp="2026-04-22T14:30:00", crew="inbound", action="Enrichment refreshed", detail="Sofia Alencar · LinkedIn + Crunchbase", contact_id="sofia-alencar"),
    dict(timestamp="2026-04-21T09:00:00", crew="social", action="DM triaged", detail="Kai Jensen · Instagram", contact_id="kai-jensen"),
    dict(timestamp="2026-04-20T16:45:00", crew="signals", action="Warmth updated", detail="Sofia Alencar · 68 → 82", contact_id="sofia-alencar"),
    dict(timestamp="2026-04-19T11:20:00", crew="inbound", action="Cold email qualified", detail="Diego Alvarez · Grupo Santander", contact_id="diego-alvarez"),
    dict(timestamp="2026-04-18T18:00:00", crew="scribe", action="Meeting transcribed", detail="ABA EXCO weekly · 46 min", contact_id=None),
]


def resolve_uid(email: str) -> str:
    user = firebase_auth.get_user_by_email(email)
    return user.uid


def run(email: str):
    uid = resolve_uid(email)
    print(f"Seeding data for uid={uid} ({email})")

    with driver.session() as session:

        session.run(
            "MERGE (:User {firebaseUid:$uid})",
            uid=uid,
        )

        for person in PEOPLE:
            pid = slugify(person["name"])

            session.run(
                """
                MATCH (me:User {firebaseUid:$uid})

                MERGE (p:Person {id:$id})

                SET
                    p.name=$name,
                    p.title=$title,
                    p.role=$title,
                    p.company=$company,
                    p.initials=$initials,
                    p.met_at=$met_at,
                    p.met_date=date($met_date),
                    p.last_contact=$last_contact,
                    p.channel=$channel,
                    p.warmth=$warmth,
                    p.signals=$signals,
                    p.last_crew=$last_crew,
                    p.autonomy=$autonomy,
                    p.org_tags=$org_tags,
                    p.handles_json=$handles_json

                MERGE (me)-[r:KNOWS]->(p)

                ON CREATE SET
                    r.firstMet=datetime(),
                    r.lastContact=datetime(),
                    r.heatScore=$warmth,
                    r.strength=$warmth
                """,
                uid=uid,
                id=pid,
                name=person["name"],
                title=person["title"],
                company=person["company"],
                initials=initials_for(person["name"]),
                met_at=person["met_at"],
                met_date=person["met_date"],
                last_contact=person["last_contact"],
                channel=person["channel"],
                warmth=person["warmth"],
                signals=person["signals"],
                last_crew=person["last_crew"],
                autonomy=person["autonomy"],
                org_tags=person["org_tags"],
                handles_json=json.dumps(person["handles"]),
            )

        for key, blob in ENRICHMENTS.items():
            pid = slugify(next(p["name"] for p in PEOPLE if slugify(p["name"]).startswith(key)))
            session.run(
                "MATCH (p:Person {id:$id}) SET p.enrichment_json=$blob",
                id=pid,
                blob=json.dumps(blob),
            )

        for key, rows in INTERACTIONS.items():
            pid = slugify(next(p["name"] for p in PEOPLE if slugify(p["name"]).startswith(key)))
            for i, row in enumerate(rows):
                session.run(
                    """
                    MATCH (p:Person {id:$pid})

                    MERGE (i:Interaction {id:$iid})

                    SET
                        i.timestamp=datetime($timestamp),
                        i.day_label=$day_label,
                        i.channel=$channel,
                        i.direction=$direction,
                        i.kind=$kind,
                        i.preview=$preview,
                        i.crew=$crew

                    MERGE (p)-[:HAD_INTERACTION]->(i)
                    """,
                    pid=pid,
                    iid=f"{pid}-int-{i}",
                    **row,
                )

        for key, points in WARMTH_TIMELINE.items():
            pid = slugify(next(p["name"] for p in PEOPLE if slugify(p["name"]).startswith(key)))
            for point in points:
                session.run(
                    """
                    MATCH (p:Person {id:$pid})

                    MERGE (w:WarmthPoint {id:$wid})

                    SET
                        w.day=$day,
                        w.date=date($date),
                        w.warmth=$warmth,
                        w.event=$event,
                        w.channel=$channel

                    MERGE (p)-[:WARMTH_POINT]->(w)
                    """,
                    pid=pid,
                    wid=f"{pid}-wp-{point['day']}",
                    **point,
                )

        for i, draft in enumerate(DRAFTS):
            pid = slugify(next(p["name"] for p in PEOPLE if slugify(p["name"]).startswith(draft["contact"])))
            session.run(
                """
                MATCH (p:Person {id:$pid})

                MERGE (d:Draft {id:$did})

                SET
                    d.crew=$crew,
                    d.channel=$channel,
                    d.warmth=$warmth,
                    d.inbound_text=$inbound_text,
                    d.inbound_timestamp=$inbound_timestamp,
                    d.signal_chips=$signal_chips,
                    d.draft=$draft,
                    d.reasoning=$reasoning,
                    d.reasoning_trail_json=$reasoning_trail_json,
                    d.status=$status

                MERGE (p)-[:HAS_DRAFT]->(d)
                """,
                pid=pid,
                did=f"draft-{i}",
                crew=draft["crew"],
                channel=draft["channel"],
                warmth=draft["warmth"],
                inbound_text=draft["inbound_text"],
                inbound_timestamp=draft["inbound_timestamp"],
                signal_chips=draft["signal_chips"],
                draft=draft["draft"],
                reasoning=draft["reasoning"],
                reasoning_trail_json=json.dumps(draft["reasoning_trail"]),
                status=draft["status"],
            )

        for i, note in enumerate(VOICE_NOTES):
            session.run(
                """
                MATCH (u:User {firebaseUid:$uid})

                MERGE (v:VoiceNote {id:$vid})

                SET
                    v.source=$source,
                    v.date=date($date),
                    v.duration_sec=$duration_sec,
                    v.title=$title,
                    v.transcript_preview=$transcript_preview,
                    v.commitments=$commitments,
                    v.contact_ids=$contact_ids

                MERGE (u)-[:HAS_VOICE_NOTE]->(v)
                """,
                uid=uid,
                vid=f"voice-{i}",
                **note,
            )

        for i, card in enumerate(CARDS):
            session.run(
                """
                MATCH (u:User {firebaseUid:$uid})

                MERGE (c:Card {id:$cid})

                SET
                    c.state=$state,
                    c.filename=$filename,
                    c.captured_at=datetime($captured_at),
                    c.extracted_json=$extracted_json,
                    c.error_reason=$error_reason

                MERGE (u)-[:HAS_CARD]->(c)
                """,
                uid=uid,
                cid=f"card-{i}",
                state=card["state"],
                filename=card["filename"],
                captured_at=card["captured_at"],
                extracted_json=json.dumps(card.get("extracted") or {}),
                error_reason=card.get("error_reason"),
            )

        for i, entry in enumerate(ACTIVITY):
            session.run(
                """
                MATCH (u:User {firebaseUid:$uid})

                MERGE (a:ActivityEntry {id:$aid})

                SET
                    a.timestamp=datetime($timestamp),
                    a.crew=$crew,
                    a.action=$action,
                    a.detail=$detail,
                    a.contact_id=$contact_id

                MERGE (u)-[:HAS_ACTIVITY]->(a)
                """,
                uid=uid,
                aid=f"activity-{i}",
                **entry,
            )

    print(f"Done. Seeded {len(PEOPLE)} contacts, {len(DRAFTS)} drafts, "
          f"{len(VOICE_NOTES)} voice notes, {len(CARDS)} cards, {len(ACTIVITY)} activity entries.")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python seed_data.py <your-login-email>")
        sys.exit(1)

    run(sys.argv[1])
