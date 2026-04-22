import os
import json
import uuid
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import anthropic
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = anthropic.Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))

sessions: dict[str, list] = {}

SYSTEM_PROMPT = (
    "You are a helpful, friendly AI assistant similar to Gemini. "
    "You can see the user's screen when they share it with you — describe what you see and answer questions about it. "
    "When responding in voice mode, keep answers concise and natural for spoken conversation. "
    "Be warm, clear, and genuinely helpful."
)


@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    await websocket.accept()

    if session_id not in sessions:
        sessions[session_id] = []

    try:
        while True:
            raw = await websocket.receive_text()
            payload = json.loads(raw)

            user_text: str = payload.get("message", "").strip()
            image_b64: str | None = payload.get("image")

            message_content: list = []

            if image_b64:
                # Strip data-URL prefix if present
                if "," in image_b64:
                    image_b64 = image_b64.split(",", 1)[1]
                message_content.append({
                    "type": "image",
                    "source": {
                        "type": "base64",
                        "media_type": "image/png",
                        "data": image_b64,
                    },
                })

            if user_text:
                message_content.append({"type": "text", "text": user_text})

            if not message_content:
                continue

            sessions[session_id].append({"role": "user", "content": message_content})

            full_response = ""
            try:
                with client.messages.stream(
                    model="claude-sonnet-4-6",
                    max_tokens=1024,
                    system=SYSTEM_PROMPT,
                    messages=sessions[session_id],
                ) as stream:
                    for chunk in stream.text_stream:
                        full_response += chunk
                        await websocket.send_json({"type": "stream", "content": chunk})
            except anthropic.APIError as e:
                await websocket.send_json({"type": "error", "content": str(e)})
                sessions[session_id].pop()
                continue

            sessions[session_id].append({"role": "assistant", "content": full_response})
            await websocket.send_json({"type": "done", "content": full_response})

    except WebSocketDisconnect:
        sessions.pop(session_id, None)
    except Exception as e:
        try:
            await websocket.send_json({"type": "error", "content": str(e)})
        except Exception:
            pass
        sessions.pop(session_id, None)


@app.delete("/session/{session_id}")
def clear_session(session_id: str):
    sessions.pop(session_id, None)
    return {"status": "cleared"}


@app.get("/health")
def health():
    return {"status": "ok"}
