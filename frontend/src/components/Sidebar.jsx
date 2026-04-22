export default function Sidebar({ chats, activeChatId, onSelect, onNewChat }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <GemSVG className="gem-icon" />
        <span>AI Assistant</span>
      </div>

      <button className="new-chat-btn" onClick={onNewChat}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
        New chat
      </button>

      {chats.length > 0 && (
        <>
          <div className="sidebar-section-label">Recent</div>
          <div className="chat-list">
            {[...chats].reverse().map(chat => (
              <div
                key={chat.id}
                className={`chat-item ${chat.id === activeChatId ? 'active' : ''}`}
                onClick={() => onSelect(chat.id)}
                title={chat.title}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ flexShrink: 0 }}>
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {chat.title}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </aside>
  )
}

function GemSVG({ className }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#4285F4" />
          <stop offset="50%" stopColor="#9B72CB" />
          <stop offset="100%" stopColor="#D96570" />
        </linearGradient>
      </defs>
      <path
        d="M24 4 L28 20 L44 24 L28 28 L24 44 L20 28 L4 24 L20 20 Z"
        fill="url(#g1)"
      />
    </svg>
  )
}
