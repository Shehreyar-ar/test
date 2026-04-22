#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"

# ── Check Ollama is installed ──────────────────────────────
if ! command -v ollama &>/dev/null; then
  echo ""
  echo "  ┌─────────────────────────────────────────────────────┐"
  echo "  │  Ollama is not installed.                           │"
  echo "  │  Download it from: https://ollama.com              │"
  echo "  │  Then run ./start.sh again.                        │"
  echo "  └─────────────────────────────────────────────────────┘"
  exit 1
fi

# ── Start Ollama server if not already running ─────────────
if ! curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
  echo "▸ Starting Ollama server…"
  ollama serve &
  sleep 3
fi

# ── Pull models if not already downloaded ─────────────────
echo "▸ Checking models (downloads on first run — may take a while)…"
ollama pull gemma3
ollama pull llava

# ── Backend ────────────────────────────────────────────────
echo "▸ Installing backend dependencies…"
pip install -r "$ROOT/backend/requirements.txt" -q

echo "▸ Starting backend on http://localhost:8000 …"
cd "$ROOT/backend"
python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 &
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
