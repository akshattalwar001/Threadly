from fastapi import APIRouter, Depends

from app.services.pulse_service import pulse_service
from app.dependencies.auth import get_current_user

router = APIRouter()


@router.get("/dashboard")
def dashboard(user=Depends(get_current_user)):

    return pulse_service.dashboard(
        user["uid"]
    )


@router.get("/recently-active")
def recently_active(user=Depends(get_current_user)):

    return pulse_service.recently_active(
        user["uid"]
    )