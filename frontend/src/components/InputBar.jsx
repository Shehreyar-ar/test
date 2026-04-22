import { useRef, useEffect } from 'react'

export default function InputBar({
  value, onChange, onSend,
  isListening, interimTranscript, onMicToggle,
  isSharing, onShareToggle,
  disabled, isSpeaking, onStopSpeaking,
}) {
  const textareaRef = useRef(null)

  useEffect(() => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 180) + 'px'
  }, [value])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!disabled && value.trim()) onSend()
    }
  }

  const canSend = !disabled && (value.trim() || isSharing)

  return (
    <div className="input-wrapper">
      {isListening && interimTranscript && (
        <div className="interim-hint">🎤 {interimTranscript}…</div>
      )}

      <div className="input-bar">
        <textarea
          ref={textareaRef}
          className="input-textarea"
          placeholder={
            isSharing
              ? 'Ask about your screen… (Enter to send)'
              : isListening
              ? 'Listening…'
              : 'Ask anything (Enter to send, Shift+Enter for newline)'
          }
          value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={disabled}
        />

        {/* Stop speaking */}
        {isSpeaking && (
          <button className="icon-btn stop-speaking" onClick={onStopSpeaking} title="Stop speaking">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          </button>
        )}

        {/* Mic */}
        <button
          className={`icon-btn ${isListening ? 'mic-active' : ''}`}
          onClick={onMicToggle}
          disabled={disabled && !isListening}
          title={isListening ? 'Stop listening' : 'Voice input'}
        >
          {isListening ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <rect x="9" y="9" width="6" height="6" rx="1" />
              <path d="M12 1a3 3 0 0 1 3 3v8a3 3 0 0 1-6 0V4a3 3 0 0 1 3-3z" opacity="0.3" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 1a3 3 0 0 1 3 3v8a3 3 0 0 1-6 0V4a3 3 0 0 1 3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
              <line x1="12" y1="19" x2="12" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              <line x1="8" y1="23" x2="16" y2="23" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          )}
        </button>

        {/* Screen share */}
        <button
          className={`icon-btn ${isSharing ? 'share-active' : ''}`}
          onClick={onShareToggle}
          title={isSharing ? 'Stop sharing screen' : 'Share screen'}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <polyline points="8 21 12 17 16 21" />
            {isSharing && <circle cx="12" cy="10" r="3" fill="currentColor" stroke="none" />}
          </svg>
        </button>

        {/* Send */}
        <button
          className={`icon-btn ${canSend ? 'send-active' : ''}`}
          onClick={onSend}
          disabled={!canSend}
          title="Send"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="22" y1="2" x2="11" y2="13" />
            <polygon points="22 2 15 22 11 13 2 9 22 2" />
          </svg>
        </button>
      </div>

      <p className="disclaimer">AI can make mistakes. Verify important info.</p>
    </div>
  )
}
