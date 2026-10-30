# Threadly

![Threadly Logo](./public/brand/logocolor.png)

**A Chief and a Crew of AI specialists that keep every relationship you've ever made alive, warm, and queryable.**

Threadly is a relationship intelligence platform built on a shared graph architecture. The frontend is a Next.js app and the backend is a FastAPI service connected to Firebase Authentication, Neo4j Aura, and Groq. The goal is a stable demo where every live feature works end to end.

---

## 🎯 What is Threadly?

Five AI specialists manage every relationship in the background. One Chief answers questions across the whole graph.

- **Chief** - Master Connect: Ask your relationship graph anything in plain English
- **Snap** - Business cards → enriched contacts in seconds
- **Nudge** - Secret cues trigger perfectly-timed follow-ups
- **Gatekeeper** - Inbound screening + qualification
- **Pulse** - Real-time network health score, recently-active contacts, and the full crew activity log
- **Recall** - Voice notes → structured memory + follow-ups

### Live MVP

The current MVP supports:

- Google / email auth through Firebase
- User sync from Firebase into Neo4j
- Live Crew actions through `POST /crew/action`
- Scanner contact capture into the graph
- Chief-style answers on the Connect page
- Dashboard stats backed by Neo4j queries

### Three Tiers

| Tier | Use Case | Scale |
|------|----------|-------|
| **Solo** | Individual operators, creators, founders | One voice, one graph |
| **Teams** | Founders, BD, IR, community leads | Shared team graph, 4-20 people |
| **Enterprise** | VCs, family offices, holding companies | Portfolio networks, strict entity walls |

---

## ✨ Features

### Current Product Surface

- Next.js dashboard with Chief briefing, Crew console, stats cards, and relationship views
- Connect page with question/answer Chief flow and suggested prompts
- Authenticated sidebar with logout
- Shared Firebase auth state across onboarding, dashboard, and crew pages
- FastAPI backend with a single Crew action endpoint
- Neo4j graph storage for people, companies, topics, events, and interactions

### Solo Tier
- Six AI Crew members trained on your voice
- Every contact across Telegram, WhatsApp, Gmail, LinkedIn in one graph
- 10-minute Morning Connect daily ritual
- Per-contact autonomy (auto-send, approve, or never-auto-draft)

### Teams Tier
- One shared graph every teammate contributes to
- Coordinated outreach (Crew knows who's already touched a contact)
- Duplicate-touch alerts before sends
- SSO, SCIM provisioning, audit logs

### Enterprise Tier
- Portfolio company independence + fund-level visibility
- Two-gate governance (fund approval + contact owner approval)
- Aggregate metadata only (walls ARE the feature)
- Custom DPAs, data residency, compliance-ready architecture

---

## 🏗️ Tech Stack

- **Frontend Framework:** [Next.js](https://nextjs.org/) 16.2.9 (Turbopack)
- **Backend Framework:** FastAPI
- **Language:** TypeScript 5 + Python 3
- **Styling:** Tailwind CSS 4 with PostCSS
- **UI Icons:** Lucide React 1.18.0
- **Auth:** Firebase Authentication + Firebase Admin SDK
- **Graph Database:** Neo4j Aura
- **LLM:** Groq
- **Deployment:** Vercel frontend + hosted FastAPI backend

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Python 3.11+
- npm or yarn

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd threadly

# Install dependencies
npm install

# Install required utilities
npm install clsx tailwind-merge

# Backend setup
cd backend
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
```

### Development

```bash
# Start frontend dev server
npm run dev

# Open http://localhost:3000

# In a second terminal, start the backend
cd backend
uvicorn app.main:app --reload
```

### Build & Deploy

```bash
# Build for production
npm run build

# Start production server
npm start
```

**Vercel Deployment:**
- Root Directory: `./` (default)
- Build Command: Auto-detected
- Output Directory: `.next` (auto-detected)
- No custom configuration needed

**Backend Deployment:**
- Deploy the FastAPI app separately
- Set `NEXT_PUBLIC_BACKEND_URL` in Vercel to the backend URL
- Set `CORS_ORIGINS` in the backend to include the deployed frontend origin

---

## 📁 Project Structure

```
threadly/
├── backend/
│   ├── app/
│   │   ├── main.py            # FastAPI app + CORS + routes
│   │   ├── auth.py            # Firebase token verification
│   │   ├── config.py          # Env config
│   │   ├── services/          # Scanner, Graph, LLM, Firebase, Neo4j
│   │   └── routes/            # Auth, Crew, Dashboard, Scanner, etc.
│   └── requirements.txt
├── public/
│   ├── brand/
│   │   ├── favicon.png          # Favicon (dark)
│   │   ├── faviconc.png         # Favicon (color)
│   │   ├── logobg.png           # Logo (background)
│   │   ├── logoblack.png        # Logo (black)
│   │   ├── logocolor.png        # Logo (color)
│   │   └── logowhite.png        # Logo (white)
│   └── [other assets]
├── src/
│   ├── app/
│   │   ├── page.tsx             # Homepage
│   │   ├── enterprise/          # Enterprise tier marketing
│   │   ├── teams/               # Teams tier marketing
│   │   ├── layout.tsx           # Root layout
│   │   └── globals.css          # Global styles + theme
│   ├── components/              # React components
│   │   ├── dashboard/           # Chief, Crew console, stats cards
│   │   ├── auth/                # Login UI
│   │   ├── onboarding/          # Onboarding steps
│   │   └── [other components]
│   └── lib/
│       ├── api.ts               # Crew action client
│       ├── auth.ts              # Firebase sign-in helpers
│       ├── firebase.ts          # Firebase client init
│       ├── utils.ts             # Tailwind utilities
│       └── fixtures.ts          # Demo data
├── package.json
├── tsconfig.json
├── next.config.ts
└── README.md
```

---

## 🔌 Runtime Environment

### Frontend

Set these in Vercel:

- `NEXT_PUBLIC_BACKEND_URL` - deployed FastAPI base URL
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

### Backend

Set these in the FastAPI environment:

- `NEO4J_URI`
- `NEO4J_USERNAME`
- `NEO4J_PASSWORD`
- `FIREBASE_PROJECT_ID`
- `GROQ_API_KEY`
- `CORS_ORIGINS` - comma-separated allowed frontend origins
- `TELEGRAM_API_ID`, `TELEGRAM_API_HASH`, `TELEGRAM_SESSION_KEY` - Telegram sync
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` - OAuth client credentials from Google Cloud Console
- `GOOGLE_REDIRECT_URI` - must match a redirect URI registered on the OAuth client (defaults to `http://localhost:8000/google/oauth/callback`)
- `GOOGLE_TOKEN_KEY` - Fernet key used to encrypt stored Google OAuth tokens (generate with `Fernet.generate_key()`)
- `FRONTEND_URL` - used to redirect back to the app after the Google OAuth callback (defaults to `http://localhost:3000`)

---

## 🎨 Design System

**Brand Colors:**
- Indigo (Chief) - `#3d4e7e`
- Coral (Snap) - `#e85a3c`
- Teal (Nudge) - `#2d7d7a`
- Copper (Gatekeeper) - `#c07a2c`
- Indigo (Pulse) - `#3d4e7e`
- Sage (Recall) - `#7b9a8d`

**Typography:**
- Editorial: Brand-forward serif font
- Mono: System monospace for UI labels

**Spacing:** 8px base unit (Tailwind)

**Product UI:**
- Chief briefing and Connect live answers
- Dashboard stats backed by live graph data
- Crew console for the supported MVP actions

---

### Auth Notes

- Authentication uses Firebase on the frontend
- Backend requests are authenticated with Firebase ID tokens
- The backend verifies the token before querying Neo4j
- The deployed frontend origin must be allowed in backend CORS

---

**Made with ❤️ by Waqar Akhtar.**
