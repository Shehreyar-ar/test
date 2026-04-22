import os
import json
import base64
import io
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import google.generativeai as genai
from PIL import Image
from dotenv import load_dotenv

load_dotenv()

genai.configure(api_key=os.getenv("GOOGLE_API_KEY"))

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SYSTEM_PROMPT = (
    "You are a helpful, friendly AI assistant. "
    "You can see the user's screen when they share it — describe what you see and answer questions about it. "
    "When responding in voice mode, keep answers concise and natural for spoken conversation. "
    "Be warm, clear, and genuinely helpful."
)

MODEL_NAME = "gemini-2.0-flash"

# session_id → list of conversation turns (for history)
sessions: dict[str, genai.ChatSession] = {}


def make_chat() -> genai.ChatSession:
    model = genai.GenerativeModel(
        model_name=MODEL_NAME,
        system_instruction=SYSTEM_PROMPT,
    )
    return model.start_chat(history=[])


async def stream_gemini(chat: genai.ChatSession, parts: list):
    """Run the blocking Gemini stream in a thread and yield chunks via a queue."""
    queue: asyncio.Queue[str | None] = asyncio.Queue()
    loop = asyncio.get_event_loop()

    def _blocking():
        try:
            response = chat.send_message(parts, stream=True)
            for chunk in response:
                text = getattr(chunk, "text", None)
                if text:
                    loop.call_soon_threadsafe(queue.put_nowait, text)
        except Exception as exc:
            loop.call_soon_threadsafe(queue.put_nowait, f"\n\n[Error: {exc}]")
        finally:
            loop.call_soon_threadsafe(queue.put_nowait, None)

    future = loop.run_in_executor(None, _blocking)

    while True:
        chunk = await queue.get()
        if chunk is None:
            break
        yield chunk

    await future


@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    await websocket.accept()

    chat = sessions.get(session_id) or make_chat()
    sessions[session_id] = chat

    try:
        while True:
            raw = await websocket.receive_text()
            payload = json.loads(raw)

            user_text: str = payload.get("message", "").strip()
            image_b64: str | None = payload.get("image")

            parts: list = []

            if image_b64:
                if "," in image_b64:
                    image_b64 = image_b64.split(",", 1)[1]
                img_bytes = base64.b64decode(image_b64)
                img = Image.open(io.BytesIO(img_bytes))
                parts.append(img)

            if user_text:
                parts.append(user_text)

            if not parts:
                continue

            full_response = ""
            try:
                async for chunk in stream_gemini(chat, parts):
                    full_response += chunk
                    await websocket.send_json({"type": "stream", "content": chunk})
            except Exception as e:
                await websocket.send_json({"type": "error", "content": str(e)})
                continue

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
