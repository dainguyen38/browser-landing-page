# browser-landing-page

A glassmorphism new-tab landing page. 100% local — works offline.

**Features**

- Live clock + date with greeting
- Pinned websites (favicon + custom icon override)
- Todo list (priority, due date, category, filter, sort)
- 8 bundled 4K wallpapers + your own uploads (stored in IndexedDB)
- Drag-and-drop widget reorder + show/hide
- VI / EN UI toggle
- Everything persisted locally (zero network needed after first load)

**Stack:** Vite + React + TypeScript, TailwindCSS, shadcn-style primitives (Radix), Zustand, dnd-kit, idb-keyval, date-fns.

## Run

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production bundle in dist/
npm run preview  # serve the production bundle
```

## Use it as your browser's new tab

After deploying `dist/` (Vercel, Netlify, GitHub Pages, or any static host):

- **Chrome / Edge / Brave** — Settings → On startup → "Open a specific page", paste the URL. Or use a "New Tab Redirect" extension to override the new-tab page itself.
- **Firefox** — Settings → Home → New Windows and Tabs → Custom URLs.

## Data locations

- `localStorage`
  - `landing.todos.v1` — todos + filter + sort
  - `landing.pinned.v1` — pinned sites
  - `landing.settings.v1` — wallpaper id, locale, greeting name, hour24
  - `landing.layout.v1` — widget order + hidden
- `IndexedDB` (via `idb-keyval`)
  - `wallpaper:<uuid>` — Blob for each user-uploaded wallpaper

Reset everything from Settings → Settings tab → Danger zone → Reset all data.

## Replace the bundled wallpapers

Drop your own 4K JPGs into `src/assets/wallpapers/` named `01.jpg` … `08.jpg`. See `src/assets/wallpapers/CREDITS.md` for the originals.
