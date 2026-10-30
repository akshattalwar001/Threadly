from fastapi import APIRouter, Depends

from app.schemas.chief import ChiefRequest, ChiefResponse
from app.services.chief_service import chief_service
from app.dependencies.auth import get_current_user

router = APIRouter()


@router.post("/ask", response_model=ChiefResponse)
def chief_ask(
    request: ChiefRequest,
    user=Depends(get_current_user),
):
    return chief_service.ask(
        user["uid"],
        request.question,
    )
