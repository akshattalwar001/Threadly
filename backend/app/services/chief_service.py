import json
from pathlib import Path

from app.schemas.chief import ChiefResponse
from app.services.graph_service import graph_service
from app.services.llm_service import llm

PROMPT_PATH = (
    Path(__file__).parent.parent
    / "prompts"
    / "chief.md"
)


class ChiefService:
    def __init__(self):
        self.system_prompt = PROMPT_PATH.read_text(
            encoding="utf-8"
        )

    def _network_context(self, uid: str) -> dict:
        contacts = graph_service.get_contacts(uid)

        return {
            "stats": graph_service.network_stats(uid),
            "top_companies": graph_service.top_companies(uid),
            "founders": graph_service.get_founders(uid),
            "ai_people": graph_service.get_ai_people(uid),
            "overdue_for_followup": graph_service.people_needing_followup(uid),
            "contacts_sample": [
                {
                    "name": c["name"],
                    "company": c["company"],
                    "title": c["title"],
                    "warmth": c["warmth"],
                    "last_contact": c["last_contact"],
                    "channel": c["channel"],
                }
                for c in contacts[:40]
            ],
        }

    def ask(self, uid: str, question: str) -> ChiefResponse:
        network = self._network_context(uid)

        response = llm.chat(
            system_prompt=self.system_prompt,
            user_prompt=json.dumps({
                "question": question,
                "network": network,
            }),
        )

        data = json.loads(response)
        data.setdefault("cards", None)

        return ChiefResponse.model_validate(data)


chief_service = ChiefService()
