# Firebase Setup From Scratch

Threadly uses Firebase in two places:
- **Frontend** (`src/lib/firebase.ts`): Firebase Auth client SDK (Google + email/password sign-in).
- **Backend** (`backend/app/firebase.py`): Firebase Admin SDK, used to verify ID tokens sent from the frontend.

Both need to point at the **same Firebase project**.

## 1. Create the Firebase project

1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Click **Add project**, give it a name (e.g. `threadly` or `threadly-dev`).
3. Disable Google Analytics for the project unless you want it (not used by this app).
4. Click **Create project** and wait for it to finish provisioning.

## 2. Enable Authentication providers

1. In the left sidebar, go to **Build → Authentication**.
2. Click **Get started**.
3. Under **Sign-in method**, enable:
   - **Google** — pick a support email, save.
   - **Email/Password** — enable it, save.

## 3. Register a Web App (for the frontend config)

1. In the Firebase console, go to **Project settings** (gear icon top-left) → **General**.
2. Under **Your apps**, click the **`</>`** (web) icon to add a web app.
3. Give it a nickname (e.g. `threadly-web`), don't check "Firebase Hosting".
4. Click **Register app**. You'll be shown a `firebaseConfig` object like:

   ```js
   const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "threadly-xxxx.firebaseapp.com",
     projectId: "threadly-xxxx",
     storageBucket: "threadly-xxxx.appspot.com",
     messagingSenderId: "123456789012",
     appId: "1:123456789012:web:abcdef123456",
   };
   ```

5. Keep this tab open — you'll copy these values into `.env.local` in step 5.

## 4. Generate a Service Account key (for the backend)

1. Still in **Project settings**, go to the **Service accounts** tab.
2. Click **Generate new private key** → confirm. This downloads a JSON file.
3. Rename it to `serviceAccountKey.json` and place it at:
   ```
   C:\Code\Threadly\backend\serviceAccountKey.json
   ```
4. **Do not commit this file.** Confirm `backend/serviceAccountKey.json` is covered by `.gitignore` (add it if not).

   Alternative for deployed environments (e.g. Render): instead of a file, set an env var `FIREBASE_SERVICE_ACCOUNT` containing the entire JSON file contents as a single-line string — `backend/app/firebase.py` checks for this env var first and falls back to the local file.

## 5. Set frontend env vars

Create `C:\Code\Threadly\.env.local` (gitignored, not committed) with the values from step 3:

```
NEXT_PUBLIC_FIREBASE_API_KEY=AIza...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=threadly-xxxx.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=threadly-xxxx
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=threadly-xxxx.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abcdef123456
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
```

Restart `npm run dev` after creating/editing this file — Next.js only reads `.env.local` at startup.

## 6. Set backend env vars

Create `C:\Code\Threadly\backend\.env` (gitignored, not committed):

```
FIREBASE_PROJECT_ID=threadly-xxxx
NEO4J_URI=
NEO4J_USERNAME=
NEO4J_PASSWORD=
GROQ_API_KEY=
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

(Neo4j and Groq aren't Firebase-related, but `backend/app/config.py` loads them from the same `.env` file — leave them blank for now if you're only setting up auth.)

## 7. Verify it works

1. Start both servers:
   - Frontend: `npm run dev` (from repo root)
   - Backend: `cd backend && uvicorn app.main:app --reload`
2. Visit `http://localhost:3000` — it should load without the `auth/invalid-api-key` error.
3. Try signing in via `/auth` with Google or email/password.
4. On success, the frontend sends the Firebase ID token to the backend, which verifies it via `firebase_admin.auth` in `backend/app/dependencies/auth.py` before allowing access to `/dashboard`, `/crew`, etc.
