import { useEffect } from 'react'

export default function ScreenPreview({ videoRef, onCapture, onStop }) {
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.autoplay = true
    video.muted = true
    video.playsInline = true
  }, [videoRef])

  return (
    <div className="screen-preview">
      <video ref={videoRef} />
      <div className="screen-preview-bar">
        <span>
          <span className="live-dot" />
          Screen sharing
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          <button onClick={onCapture} title="Send current frame">Ask</button>
          <button onClick={onStop} title="Stop sharing">Stop</button>
        </div>
      </div>
    </div>
  )
}
