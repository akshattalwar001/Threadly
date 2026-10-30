from dotenv import load_dotenv
import os

load_dotenv()

NEO4J_URI = os.getenv("NEO4J_URI")
NEO4J_USERNAME = os.getenv("NEO4J_USERNAME")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD")

FIREBASE_PROJECT_ID = os.getenv("FIREBASE_PROJECT_ID")

GROQ_API_KEY = os.getenv("GROQ_API_KEY")

TELEGRAM_API_ID = os.getenv("TELEGRAM_API_ID")
TELEGRAM_API_HASH = os.getenv("TELEGRAM_API_HASH")
TELEGRAM_SESSION_KEY = os.getenv("TELEGRAM_SESSION_KEY")

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
GOOGLE_REDIRECT_URI = os.getenv(
    "GOOGLE_REDIRECT_URI",
    "http://localhost:8000/google/oauth/callback",
)
GOOGLE_TOKEN_KEY = os.getenv("GOOGLE_TOKEN_KEY")

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

CORS_ORIGINS = [
	origin.strip()
	for origin in os.getenv(
		"CORS_ORIGINS",
		"http://localhost:3000,http://127.0.0.1:3000",
	).split(",")
	if origin.strip()
]