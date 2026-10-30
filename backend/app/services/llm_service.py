from groq import Groq
from app.config import GROQ_API_KEY

client = Groq(api_key=GROQ_API_KEY)


class LLMService:
    def __init__(self):
        self.model = "openai/gpt-oss-120b"

    def chat(
        self,
        system_prompt: str,
        user_prompt: str,
    ) -> str:

        response = client.chat.completions.create(
            model=self.model,
            temperature=0.2,
            response_format={"type": "json_object"},
            messages=[
                {
                    "role": "system",
                    "content": system_prompt,
                },
                {
                    "role": "user",
                    "content": user_prompt,
                },
            ],
        )

        return response.choices[0].message.content


llm = LLMService()