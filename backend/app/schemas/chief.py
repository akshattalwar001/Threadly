from typing import Optional
from pydantic import BaseModel


class ChiefRequest(BaseModel):
    question: str


class ChiefCard(BaseModel):
    name: str
    role: str = ""
    company: str = ""
    reason: str = ""
    potential: str = ""


class ChiefResponse(BaseModel):
    text: str
    cards: Optional[list[ChiefCard]] = None
