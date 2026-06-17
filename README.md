# Zenith Focus | Personal Office Hours & Productivity Tracker

Zenith Focus is a premium, lightweight, and responsive personal productivity portal designed for a single user. It integrates a live work/break tracking session controller, interactive checklist planners, visual graphs, and AI-powered performance audits. All sessions are synced in real-time to Supabase (with a robust local JSON file database fallback for offline usage).

---

## 🚀 Key Features

* **Personal Authentication**: Session lock portal powered by password protection and JSON Web Tokens.
* **Ticking Timers**: Dynamic working and break tracking controls. Restores active session indicators after page reloads.
* **Auto-Recovery Dialog**: Auto-detects forgotten active sessions past midnight and provides options to close retroactively or discard them.
* **Dual Database Engine**: Real-time sync to Supabase, automatically restoring data to the local cache if empty. Falls back to a local JSON file database (`server/data/db.json`) if Supabase credentials are not set.
* **Analytics Dashboard**: Renders weekly hours charts and monthly productivity scores using Recharts.
* **AI Productivity Coach**: Integrates Google Gemini API (model `gemini-1.5-flash`) to generate daily performance reviews, weekly focus audits, and routine suggestions. Automatically falls back to a custom local heuristic engine if API keys are missing.
* **Schedule Planner**: Manage daily targets, high/medium/low priority boards, task checklists, and sticky notifications.
* **Premium UI/UX**: Implements dark & light responsive layouts, CSS-driven glassmorphism, outfit headers, and fluid hover transitions.

---

## 🛠 Tech Stack

* **Frontend**: React, TypeScript, Vite, Recharts, Lucide React
* **Backend**: Node.js, Express, TypeScript, Supabase JS Client, Google Gen AI SDK
* **Database**: Supabase Database (Fallback: Local JSON Database)

---

## 📁 Project Structure

```text
├── package.json               # Monorepo scripts (concurrent execution)
├── supabase_setup.md          # Supabase Database setup guide
├── client/                    # React + Vite frontend
│   ├── src/
│   │   ├── components/        # Sidebar, GlassCard components
│   │   ├── pages/             # Login, Tracker, Dashboard, CalendarView, Planner, Settings pages
│   │   ├── api.ts             # API middleware client (JWT, headers)
│   │   ├── App.tsx            # Theme config, layout navigation
│   │   ├── main.tsx           # Dom entry
│   │   └── index.css          # CSS Variables (HSL light/dark themes, glass parameters)
│   └── index.html             # Viewport optimization
└── server/                    # Node + Express + TS backend
    ├── src/
    │   ├── config/db.ts       # Database connector (JSON database cache, Sheets sync rules)
    │   ├── controllers/       # Session tracking, AI audits, authentication controllers
    │   ├── middlewares/       # JWT token verification gates
    │   └── index.ts           # Express routing maps
    └── data/                  # Local db.json directory (created on start)
```

---

## 💻 Local Quickstart

### Prerequisites

Make sure you have [Node.js](https://nodejs.org/) installed (v18+ recommended).

### 1. Clone & Setup Workspace

Copy `server/.env.example` to `server/.env` and configure your preferences:
```bash
# Inside server/
cp .env.example .env
```
*(You can leave Google and Gemini keys blank to test the application immediately with local storage and simulated AI heuristics).*

### 2. Install Dependencies

In the root folder, run:
```bash
npm run install:all
```
This script installs packages for the root, backend server, and frontend client.

### 3. Run Application

To launch both the React dev server and the Express API server concurrently:
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.
Log in using the default password: `admin123` (you can change this inside the Configuration settings page).

---

## 🌐 Deployment Guide

### Frontend (Vercel)

1. Connect your GitHub repository to [Vercel](https://vercel.com).
2. Set **Root Directory** to `client`.
3. Configure **Build Command** to `npm run build`.
4. Configure **Output Directory** to `dist`.
5. Set Environment Variable:
   * `VITE_API_URL`: Your deployed backend URL (e.g., `https://your-backend.onrender.com/api`).
6. Click **Deploy**.

### Backend (Render)

1. Connect your GitHub repository to [Render](https://render.com) and create a **Web Service**.
2. Set **Root Directory** to `server`.
3. Configure **Build Command** to `npm run build` (or `npm install && npm run build`).
4. Configure **Start Command** to `npm start`.
5. Add the Environment Variables:
   * `PORT`: `5000`
   * `JWT_SECRET`: (A secure random key)
   * `APP_PASSWORD`: (Your custom login password)
   * `SUPABASE_URL`: (Your Supabase URL, e.g. https://your-project.supabase.co)
   * `SUPABASE_KEY`: (Your Supabase anon/service API key)
   * `GEMINI_API_KEY`: (Optional, from Google AI Studio)
6. Click **Deploy Web Service**.
