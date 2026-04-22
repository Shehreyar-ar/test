import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export default function Message({ message, isSpeaking }) {
  const { role, content, image, isStreaming, isError } = message

  if (role === 'user') {
    return (
      <div className="message user">
        <div className="user-bubble">
          {image && <img src={image} alt="screen" className="thumb" />}
          {content}
        </div>
      </div>
    )
  }

  return (
    <div className="message assistant">
      <AiAvatarSVG className="ai-avatar" />
      <div className="ai-content">
        <div className={`prose ${isError ? 'error-msg' : ''}`}>
          {content ? (
            <>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
              {isStreaming && <span className="cursor" />}
            </>
          ) : (
            isStreaming && <span className="cursor" />
          )}
        </div>
      </div>
    </div>
  )
}

function AiAvatarSVG({ className }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="av1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor="#4285F4" />
          <stop offset="50%"  stopColor="#9B72CB" />
          <stop offset="100%" stopColor="#D96570" />
        </linearGradient>
      </defs>
      <path
        d="M16 3 L18.5 13 L28 16 L18.5 19 L16 29 L13.5 19 L4 16 L13.5 13 Z"
        fill="url(#av1)"
      />
    </svg>
  )
}
