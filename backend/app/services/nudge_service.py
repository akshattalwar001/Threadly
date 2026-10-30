import json
from pathlib import Path

from app.services.graph_service import graph_service
from app.services.llm_service import llm

PROMPT = (
    Path(__file__).parent.parent
    / "prompts"
    / "nudge.md"
).read_text(encoding="utf-8")


class NudgeService:

    def suggestions(
        self,
        uid: str,
    ):

        people = graph_service.people_needing_followup(uid)

        response = llm.chat(
            system_prompt=PROMPT,
            user_prompt=json.dumps(people),
        )

        return json.loads(response).get("suggestions", [])


nudge = NudgeService()