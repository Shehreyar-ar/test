#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

# ── Check API key ──────────────────────────────────────────
if [ ! -f "$ROOT/backend/.env" ]; then
  cp "$ROOT/backend/.env.example" "$ROOT/backend/.env"
  echo ""
  echo "  ┌─────────────────────────────────────────────────────┐"
  echo "  │  backend/.env was created.                          │"
  echo "  │  Add your Google API key:                           │"
  echo "  │    GOOGLE_API_KEY=AIza...                           │"
  echo "  └─────────────────────────────────────────────────────┘"
  echo ""
  echo "  Then run ./start.sh again."
  exit 1
fi

if ! grep -q "GOOGLE_API_KEY=." "$ROOT/backend/.env" 2>/dev/null; then
  echo "  ⚠  Set your GOOGLE_API_KEY in backend/.env first."
  exit 1
fi

# ── Backend ────────────────────────────────────────────────
echo "▸ Installing backend dependencies…"
pip install -r "$ROOT/backend/requirements.txt" -q

echo "▸ Starting backend on http://localhost:8000 …"
uvicorn main:app --host 0.0.0.0 --port 8000 --app-dir "$ROOT/backend" &
BACKEND_PID=$!

# ── Frontend ───────────────────────────────────────────────
echo "▸ Installing frontend dependencies…"
(cd "$ROOT/frontend" && npm install --silent)

echo "▸ Starting frontend on http://localhost:5173 …"
(cd "$ROOT/frontend" && npm run dev) &
FRONTEND_PID=$!

echo ""
echo "  ┌─────────────────────────────────────────────────────┐"
echo "  │  AI Assistant is running!                           │"
echo "  │  Open:  http://localhost:5173                       │"
echo "  │  Press Ctrl+C to stop.                              │"
echo "  └─────────────────────────────────────────────────────┘"
echo ""

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" SIGINT SIGTERM
wait
