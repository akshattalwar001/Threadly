from fastapi import APIRouter, Depends, HTTPException

from app.auth import verify_user
from app.services.graph_service import graph_service

router = APIRouter()


@router.get("")
def list_contacts(current_user=Depends(verify_user)):
    return graph_service.get_contacts(
        current_user["uid"]
    )


@router.get("/{contact_id}")
def get_contact(contact_id: str, current_user=Depends(verify_user)):
    contact = graph_service.get_contact(
        current_user["uid"],
        contact_id,
    )

    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")

    return contact
