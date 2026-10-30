from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.auth import verify_user
from app.services.telegram_service import telegram_service

router = APIRouter()


class StartLoginRequest(BaseModel):
    phone: str


class VerifyLoginRequest(BaseModel):
    phone: str
    code: str
    password: str | None = None


@router.get("/status")
def status(current_user=Depends(verify_user)):
    return telegram_service.status(current_user["uid"])


@router.post("/connect/start")
async def connect_start(
    request: StartLoginRequest,
    current_user=Depends(verify_user),
):
    try:
        await telegram_service.start_login(
            current_user["uid"],
            request.phone,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {"code_sent": True}


@router.post("/connect/verify")
async def connect_verify(
    request: VerifyLoginRequest,
    current_user=Depends(verify_user),
):
    try:
        result = await telegram_service.verify_login(
            current_user["uid"],
            request.phone,
            request.code,
            request.password,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return result


@router.post("/sync")
async def sync(current_user=Depends(verify_user)):
    try:
        return await telegram_service.sync_contacts(current_user["uid"])
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/disconnect")
async def disconnect(current_user=Depends(verify_user)):
    await telegram_service.disconnect(current_user["uid"])
    return {"disconnected": True}
