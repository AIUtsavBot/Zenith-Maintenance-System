# Supabase Database Setup Guide

Zenith Focus uses Supabase as a primary real-time database. If the Supabase connection is not configured, it will fall back to local file storage (`server/data/db.json`), so you can test it immediately.

Follow these steps to connect the application to your Supabase project:

---

## Step 1: Create a Supabase Project

1. Go to [Supabase](https://supabase.com/) and sign in or sign up.
2. In the dashboard, click **New Project** and select your organization.
3. Fill in your project details:
   * **Name**: `Zenith-Focus`
   * **Database Password**: (Enter a secure password and save it somewhere)
   * **Region**: Select a region close to you.
   * **Pricing**: Select the **Free Tier** (or any tier you prefer).
4. Click **Create new project** and wait a few minutes for the database to provision.

---

## Step 2: Create the Tables in SQL Editor

1. Once your project is ready, click on **SQL Editor** in the left sidebar menu (looks like a prompt icon `>_` or SQL tablet).
2. Click **New query** (or **New blank query**).
3. Paste the following SQL script into the editor:

```sql
-- Create the sessions table
create table public.sessions (
  date text primary key,
  status text not null,
  work_start text,
  work_end text,
  breaks jsonb not null default '[]'::jsonb,
  total_break_minutes integer not null default 0,
  total_work_minutes integer not null default 0,
  effective_work_minutes integer not null default 0,
  notes text not null default '',
  rating integer not null default 0,
  completed_tasks jsonb not null default '[]'::jsonb,
  goals jsonb not null default '[]'::jsonb,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS)
alter table public.sessions enable row level security;

-- Create policy to allow all actions for anonymous/authenticated keys
create policy "Allow all access for anonymous users" 
  on public.sessions for all using (true) with check (true);

-- Create the planners table
create table public.planners (
  date text primary key,
  goals jsonb not null default '[]'::jsonb,
  priorities jsonb not null default '[]'::jsonb,
  checklist jsonb not null default '[]'::jsonb,
  reminders jsonb not null default '[]'::jsonb,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS)
alter table public.planners enable row level security;

-- Create policy to allow all actions for anonymous/authenticated keys
create policy "Allow all access for anonymous users" 
  on public.planners for all using (true) with check (true);
```

4. Click **Run** at the bottom right. You should see a success message (`Success. No rows returned`).

---

## Step 3: Extract API Environment Variables

1. Click on **Project Settings** (the gear icon at the bottom of the left sidebar).
2. Select **API** under the settings menu.
3. Locate the **Project API keys** and copy your credentials:
   * **Project URL**: Copy the URL (e.g., `https://your-project-id.supabase.co`). Set this as `SUPABASE_URL` in `server/.env`.
   * **API Key (anon public)**: Copy the long token. Set this as `SUPABASE_KEY` in `server/.env`.

---

## Step 4: Configure `server/.env`

Open [server/.env](file:///d:/Projects/Workspace/Login-logout%20Mechanism/server/.env) and update your configuration:

```bash
# Supabase Configuration
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_KEY=your-anon-public-key
```

Restart your backend server. The Zenith Focus settings panel will now verify the connection as: **Supabase Sync Online**.

---

## Step 5: Data Auto-Restoration (Optional)

If your local `server/data/db.json` database is missing or empty, starting up the server with valid Supabase credentials will **automatically fetch all sessions and planners from Supabase** and populate the local file backup. This makes moving devices or deploying to new environments completely seamless!
