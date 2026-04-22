import { useEffect, useRef, useState, useCallback } from 'react'

const WS_BASE = 'ws://localhost:8000/ws'

export default function useWebSocket({ sessionId, onStream, onDone, onError }) {
  const wsRef = useRef(null)
  const [isConnected, setIsConnected] = useState(false)
  const onStreamRef = useRef(onStream)
  const onDoneRef   = useRef(onDone)
  const onErrorRef  = useRef(onError)

  useEffect(() => { onStreamRef.current = onStream }, [onStream])
  useEffect(() => { onDoneRef.current   = onDone   }, [onDone])
  useEffect(() => { onErrorRef.current  = onError  }, [onError])

  useEffect(() => {
    let retryDelay = 2000
    let timer = null
    let active = true

    function connect() {
      if (!active) return
      const ws = new WebSocket(`${WS_BASE}/${sessionId}`)

      ws.onopen = () => {
        setIsConnected(true)
        retryDelay = 2000
      }

      ws.onclose = () => {
        setIsConnected(false)
        if (active) {
          timer = setTimeout(() => {
            retryDelay = Math.min(retryDelay * 2, 16000)
            connect()
          }, retryDelay)
        }
      }

      ws.onerror = () => ws.close()

      ws.onmessage = (evt) => {
        try {
          const data = JSON.parse(evt.data)
          if (data.type === 'stream') onStreamRef.current?.(data.content)
          else if (data.type === 'done')  onDoneRef.current?.(data.content)
          else if (data.type === 'error') onErrorRef.current?.(data.content)
        } catch {
          // ignore malformed frames
        }
      }

      wsRef.current = ws
    }

    connect()

    return () => {
      active = false
      clearTimeout(timer)
      wsRef.current?.close()
    }
  }, [sessionId])

  const sendMessage = useCallback((message, image = null) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ message, image }))
    }
  }, [])

  return { sendMessage, isConnected }
}
