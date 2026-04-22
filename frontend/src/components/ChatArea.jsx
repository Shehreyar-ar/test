import { useEffect, useRef } from 'react'
import Message from './Message'

export default function ChatArea({ messages, isStreaming, isSpeaking }) {
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (messages.length === 0) {
    return (
      <div className="chat-area">
        <div className="chat-empty">
          <BigGemSVG className="big-gem" />
          <h2>How can I help you?</h2>
          <p>Chat · Voice · Screen Share</p>
        </div>
      </div>
    )
  }

  return (
    <div className="chat-area">
      <div className="messages-list">
        {messages.map(msg => (
          <Message key={msg.id} message={msg} isSpeaking={isSpeaking} />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  )
}

function BigGemSVG({ className }) {
  return (
    <svg className={className} viewBox="0 0 96 96" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor="#4285F4" />
          <stop offset="33%"  stopColor="#9B72CB" />
          <stop offset="66%"  stopColor="#D96570" />
          <stop offset="100%" stopColor="#EA4335" />
        </linearGradient>
      </defs>
      <path
        d="M48 6 L56 38 L88 48 L56 58 L48 90 L40 58 L8 48 L40 38 Z"
        fill="url(#bg1)"
        opacity="0.9"
      />
    </svg>
  )
}
