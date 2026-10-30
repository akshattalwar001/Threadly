from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

from app.auth import verify_user
from app.config import FRONTEND_URL
from app.services.google_service import google_service

router = APIRouter()


class SyncRequest(BaseModel):
    group_resource_names: list[str]


@router.get("/status")
def status(current_user=Depends(verify_user)):
    return google_service.status(current_user["uid"])


@router.get("/connect/start")
def connect_start(current_user=Depends(verify_user)):
    return {"auth_url": google_service.auth_url(current_user["uid"])}


@router.get("/groups")
def groups(current_user=Depends(verify_user)):
    try:
        return google_service.list_contact_groups(current_user["uid"])
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/oauth/callback")
def oauth_callback(code: str, state: str):
    try:
        google_service.handle_callback(code, state)
    except ValueError as e:
        return RedirectResponse(
            f"{FRONTEND_URL}/dashboard/settings?tab=channels&google=error&message={e}"
        )

    return RedirectResponse(
        f"{FRONTEND_URL}/dashboard/settings?tab=channels&google=connected"
    )


@router.post("/sync")
def sync(request: SyncRequest, current_user=Depends(verify_user)):
    try:
        return google_service.sync_contacts(
            current_user["uid"], request.group_resource_names
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/disconnect")
def disconnect(current_user=Depends(verify_user)):
    google_service.disconnect(current_user["uid"])
    return {"disconnected": True}
