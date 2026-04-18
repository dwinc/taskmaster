# TASKMASTER

A personal task dashboard for **Sjors** — designed for a 10-inch vertical
touchscreen. Clean, minimal, generous touch targets.

## Features
- Categories with custom color + icon
- Tasks with title, description, status, and deadline
- Drag-to-reorder tasks inside each category
- Search bar
- Completed tasks view, grouped by day
- Light / dark mode (auto-detects system preference on first visit)
- Browser notifications (morning digest for today's tasks + 1-hour deadline warnings)
- Data stored in `localStorage` *and* synced to Supabase so it follows you across devices
- Password-gated (browser only — **Yellow123!**)

## One-time setup

### 1. Create the database tables
Open your Supabase project → **SQL Editor** → paste the contents of
[`supabase-schema.sql`](./supabase-schema.sql) → **Run**.

This creates the `categories` and `tasks` tables, indexes, and RLS policies
that allow the publishable key to read/write those two tables.

### 2. Install & run

```bash
npm install
npm run dev
```

Open http://localhost:5173 — enter password `Yellow123!`.

### 3. Build for production

```bash
npm run build
npm run preview     # serve the build locally
```

The `dist/` folder can be served from any static host (Netlify, Vercel,
Cloudflare Pages, or just a local Nginx on the desk machine).

## Running on the 10-inch touchscreen

1. Build once, host somewhere reachable (or run `npm run preview -- --host`).
2. Open in full-screen/kiosk mode in a browser (Chrome: `--kiosk <url>`).
3. On first load, click the **bell icon** to allow notifications.
4. Unlock with `Yellow123!` — it's remembered in `localStorage` so you
   won't be prompted again on that device.

## How sync works
- Every change writes to `localStorage` immediately (instant UI, offline-safe).
- Every change is also upserted to Supabase in the background.
- On app load, the client first renders from `localStorage`, then fetches
  from Supabase and replaces local state (Supabase is the source of truth
  when reachable).
- Tap the **refresh icon** in the header for a manual re-sync.

## Notes on auth & security
- The password and the Supabase publishable key are in the client bundle.
  That's fine for a single-user personal app on your own screen — it's
  a light lock, not a real auth boundary.
- RLS policies are scoped: the publishable key can only touch the
  `categories` and `tasks` tables. Nothing else in your Supabase project
  is exposed.
- When you're ready for multi-user, swap in Supabase Auth and change the
  RLS policies to `auth.uid() = user_id`.

## File layout
```
src/
├── App.tsx                  # Top-level composition
├── main.tsx                 # React entry
├── index.css                # Tailwind + base styles
├── types.ts                 # Task / Category types
├── lib/
│   ├── constants.ts         # Palette, icons, Supabase config, password
│   ├── supabase.ts          # Supabase client
│   ├── storage.ts           # localStorage + remote sync helpers
│   ├── notifications.ts     # Browser notification scheduler
│   └── utils.ts
├── context/
│   ├── AuthContext.tsx
│   ├── ThemeContext.tsx
│   └── DataContext.tsx      # The data layer — CRUD + sync
└── components/
    ├── Login.tsx
    ├── Header.tsx
    ├── CategorySection.tsx
    ├── CategoryIcon.tsx
    ├── TaskCard.tsx
    ├── SortableTaskCard.tsx
    ├── TaskModal.tsx
    ├── CategoryModal.tsx
    ├── CompletedView.tsx
    └── Modal.tsx
```
