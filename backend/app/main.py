from fastapi import FastAPI
from app.database import get_driver
from app.routes.auth import router as auth_router
from fastapi.middleware.cors import CORSMiddleware
from app.config import CORS_ORIGINS
from app.routes.dashboard import router as dashboard_router
from app.routes.recall import router as recall_router
from app.routes.nudge import router as nudge_router

app = FastAPI(
    title="Threadly Backend",
    version="0.1.0",
)
origins = [
    "http://localhost:3000",
    "https://threadly1-gules.vercel.app"
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    return {
        "status": "running",
        "message": "Threadly Backend Running",
    }


@app.get("/neo4j-test")
def neo4j_test():
    driver = get_driver()

    with driver.session() as session:
        result = session.run(
            "RETURN 'Threadly Connected 🚀' AS message"
        )

        record = result.single()

        return {
            "neo4j": record["message"]
        }
    
app.include_router(
    auth_router,
    prefix="/auth",
    tags=["Authentication"],
)
from app.services.llm_service import llm

from app.routes.scanner import router as scanner_router

app.include_router(
    scanner_router,
    prefix="/scanner",
    tags=["Scanner"],
)
app.include_router(
    dashboard_router,
    prefix="/dashboard",
    tags=["Dashboard"],
)
app.include_router(
    recall_router,
    prefix="/recall",
    tags=["Recall"],
)
app.include_router(
    nudge_router,
    prefix="/nudge",
    tags=["Nudge"],
)
from app.routes.pulse import router as pulse_router

app.include_router(
    pulse_router,
    prefix="/pulse",
    tags=["Pulse"],
)
from app.routes.crew import router as crew_router

app.include_router(
    crew_router,
    prefix="/crew",
    tags=["Crew"],
)
from app.routes.contacts import router as contacts_router

app.include_router(
    contacts_router,
    prefix="/contacts",
    tags=["Contacts"],
)
from app.routes.telegram import router as telegram_router

app.include_router(
    telegram_router,
    prefix="/telegram",
    tags=["Telegram"],
)
from app.routes.chief import router as chief_router

app.include_router(
    chief_router,
    prefix="/chief",
    tags=["Chief"],
)
from app.routes.google import router as google_router

app.include_router(
    google_router,
    prefix="/google",
    tags=["Google"],
)