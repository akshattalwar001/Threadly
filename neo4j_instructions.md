# Neo4j Aura Setup From Scratch

The Threadly backend (`backend/app/database.py`) connects to Neo4j at startup — it will not run at all without valid credentials.

## 1. Create a free Neo4j Aura instance

1. Go to [Neo4j Aura Console](https://console.neo4j.io/).
2. Sign up / log in (Google sign-in works).
3. Click **New Instance** → choose **AuraDB Free**.
4. Give it a name (e.g. `threadly`) and pick a region close to you.
5. Click **Create**.

## 2. Save the generated credentials

Right after creation, Aura shows a **one-time** screen with:
- **Connection URI** — looks like `neo4j+s://xxxxxxxx.databases.neo4j.io`
- **Username** — always `neo4j`
- **Password** — a generated password

**Copy all three now** — the password is never shown again (you'd have to reset it if you lose it). You can also click "Download and continue" to save them to a `.txt` file.

Wait ~1-2 minutes for the instance status to become **Running** in the console.

## 3. Set backend env vars

Add these to `C:\Code\Threadly\backend\.env` (already gitignored):

```
NEO4J_URI=neo4j+s://xxxxxxxx.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=<the generated password>
```

## 4. Verify it works

Restart the backend:
```
cd backend
uvicorn app.main:app --reload
```

It should start without the `neo4j.exceptions.ConfigurationError` and without hanging — `app/database.py` only builds the driver object at import (lazy connect), so a wrong URI/password won't fail until the first real query runs. If a request to a Neo4j-backed route (e.g. `/dashboard`) fails, double check the URI scheme is `neo4j+s://` (not blank or `bolt://` unless you intentionally used a self-hosted instance) and that the password matches exactly (no trailing whitespace from copy-paste).
