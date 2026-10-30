from fastapi import APIRouter, Depends

from app.auth import verify_user
from app.services.graph_service import graph_service

router = APIRouter()


@router.get("/stats")
def dashboard_stats(current_user=Depends(verify_user)):
    return graph_service.network_stats(
        current_user["uid"]
    )


@router.get("/opportunities")
def dashboard_opportunities(current_user=Depends(verify_user)):
    return graph_service.get_opportunities(
        current_user["uid"]
    )


@router.get("/coverage")
def dashboard_coverage(current_user=Depends(verify_user)):
    return graph_service.get_coverage(
        current_user["uid"]
    )


@router.get("/activity")
def dashboard_activity(current_user=Depends(verify_user)):
    return graph_service.get_activity(
        current_user["uid"]
    )


@router.get("/analytics")
def dashboard_analytics(current_user=Depends(verify_user)):
    return graph_service.get_analytics(
        current_user["uid"]
    )


@router.get("/drafts")
def dashboard_drafts(current_user=Depends(verify_user)):
    return graph_service.get_drafts(
        current_user["uid"]
    )


@router.get("/cards")
def dashboard_cards(current_user=Depends(verify_user)):
    return graph_service.get_cards(
        current_user["uid"]
    )


@router.get("/voice-notes")
def dashboard_voice_notes(current_user=Depends(verify_user)):
    return graph_service.get_voice_notes(
        current_user["uid"]
    )
