import json
from pathlib import Path

from app.services.graph_service import graph_service
from app.services.llm_service import llm

PROMPT = (
    Path(__file__)
    .parent.parent
    / "prompts"
    / "recall.md"
).read_text(encoding="utf-8")


class RecallService:

    def _classify(self, query: str) -> dict:
        response = llm.chat(
            system_prompt=PROMPT,
            user_prompt=query,
        )

        try:
            parsed = json.loads(response)
        except ValueError:
            parsed = {}

        return {
            "intent": parsed.get("intent") or "name",
            "value": parsed.get("value") or query,
        }

    def _build_answer(self, value: str, graph: list[dict]) -> str:
        if not graph:
            return f'I couldn\'t find anyone matching "{value}" in your network.'

        names = [p.get("name") for p in graph if p.get("name")]
        preview = ", ".join(names[:5])

        remaining = len(names) - 5
        if remaining > 0:
            preview += f", and {remaining} more"

        plural = "es" if len(names) != 1 else ""

        return f"Found {len(names)} match{plural}: {preview}."

    def search(
        self,
        uid: str,
        query: str,
    ):

        classification = self._classify(query)
        intent = classification["intent"]
        value = classification["value"]

        if intent == "company":
            graph = graph_service.get_people_by_company(uid, value)
        elif intent == "topic":
            graph = graph_service.get_people_by_topic(uid, value)
        elif intent == "founder":
            graph = graph_service.get_founders(uid)
        elif intent == "ai_people":
            graph = graph_service.get_ai_people(uid)
        else:
            graph = graph_service.get_people_by_name(uid, value)

        return {
            "results": graph,
            "answer": self._build_answer(value, graph),
        }


recall = RecallService()
