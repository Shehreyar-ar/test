import { useState, useCallback, useRef, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import ChatArea from './components/ChatArea'
import InputBar from './components/InputBar'
import ScreenPreview from './components/ScreenPreview'
import useWebSocket from './hooks/useWebSocket'
import useVoice from './hooks/useVoice'
import useScreenShare from './hooks/useScreenShare'
import './App.css'

function generateId() {
  return Math.random().toString(36).slice(2, 10)
}

const SESSION_ID = generateId()

export default function App() {
  const [chats, setChats] = useState([{ id: SESSION_ID, title: 'New chat', messages: [] }])
  const [activeChatId, setActiveChatId] = useState(SESSION_ID)
  const [inputText, setInputText] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const streamingMsgIdRef = useRef(null)

  const activeChat = chats.find(c => c.id === activeChatId)
  const messages = activeChat?.messages ?? []

  const updateMessages = useCallback((chatId, updater) => {
    setChats(prev =>
      prev.map(c => (c.id === chatId ? { ...c, messages: updater(c.messages) } : c))
    )
  }, [])

  const speakText = useCallback((text) => {
    if (!window.speechSynthesis) return
    window.speechSynthesis.cancel()
    const clean = text.replace(/[#*`_~]/g, '').slice(0, 800)
    const utterance = new SpeechSynthesisUtterance(clean)
    utterance.rate = 1.05
    utterance.pitch = 1
    utterance.volume = 1
    const voices = window.speechSynthesis.getVoices()
    const preferred =
      voices.find(v => v.name.includes('Google') && v.lang.startsWith('en')) ||
      voices.find(v => v.lang.startsWith('en'))
    if (preferred) utterance.voice = preferred
    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)
    window.speechSynthesis.speak(utterance)
  }, [])

  const { sendMessage, isConnected } = useWebSocket({
    sessionId: activeChatId,
    onStream: useCallback((chunk) => {
      const msgId = streamingMsgIdRef.current
      if (!msgId) return
      updateMessages(activeChatId, msgs =>
        msgs.map(m => (m.id === msgId ? { ...m, content: m.content + chunk } : m))
      )
    }, [activeChatId, updateMessages]),
    onDone: useCallback((full) => {
      setIsStreaming(false)
      streamingMsgIdRef.current = null
      speakText(full)
    }, [speakText]),
    onError: useCallback((err) => {
      setIsStreaming(false)
      streamingMsgIdRef.current = null
      const msgId = generateId()
      updateMessages(activeChatId, msgs => [
        ...msgs,
        { id: msgId, role: 'assistant', content: `Error: ${err}`, isError: true },
      ])
    }, [activeChatId, updateMessages]),
  })

  const handleSend = useCallback((text, image = null) => {
    const trimmed = text.trim()
    if (!trimmed || isStreaming) return

    const userMsgId = generateId()
    const aiMsgId = generateId()

    updateMessages(activeChatId, msgs => {
      const updated = [
        ...msgs,
        { id: userMsgId, role: 'user', content: trimmed, image },
        { id: aiMsgId, role: 'assistant', content: '', isStreaming: true },
      ]
      if (msgs.length === 0) {
        setChats(prev =>
          prev.map(c =>
            c.id === activeChatId ? { ...c, title: trimmed.slice(0, 40) } : c
          )
        )
      }
      return updated
    })

    streamingMsgIdRef.current = aiMsgId
    setIsStreaming(true)
    sendMessage(trimmed, image)
    setInputText('')
  }, [activeChatId, isStreaming, sendMessage, updateMessages])

  const { isListening, startListening, stopListening, interimTranscript } = useVoice({
    onResult: useCallback((transcript) => {
      handleSend(transcript)
    }, [handleSend]),
    onInterim: useCallback((t) => setInputText(t), []),
  })

  const { isSharing, startShare, stopShare, captureFrame, videoRef } = useScreenShare()

  const handleScreenSend = useCallback(() => {
    const frame = captureFrame()
    const text = inputText.trim() || 'What do you see on my screen?'
    handleSend(text, frame)
  }, [captureFrame, handleSend, inputText])

  const handleNewChat = useCallback(() => {
    const id = generateId()
    setChats(prev => [...prev, { id, title: 'New chat', messages: [] }])
    setActiveChatId(id)
    window.speechSynthesis?.cancel()
    setIsSpeaking(false)
  }, [])

  return (
    <div className="app">
      <Sidebar
        chats={chats}
        activeChatId={activeChatId}
        onSelect={setActiveChatId}
        onNewChat={handleNewChat}
      />

      <div className="main">
        <header className="topbar">
          <span className="model-badge">claude-sonnet-4-6</span>
          <span className={`status-dot ${isConnected ? 'connected' : 'disconnected'}`} />
        </header>

        <ChatArea messages={messages} isStreaming={isStreaming} isSpeaking={isSpeaking} />

        {isSharing && (
          <ScreenPreview videoRef={videoRef} onCapture={handleScreenSend} onStop={stopShare} />
        )}

        <InputBar
          value={inputText}
          onChange={setInputText}
          onSend={() => {
            if (isSharing) handleScreenSend()
            else handleSend(inputText)
          }}
          isListening={isListening}
          interimTranscript={interimTranscript}
          onMicToggle={isListening ? stopListening : startListening}
          isSharing={isSharing}
          onShareToggle={isSharing ? stopShare : startShare}
          disabled={isStreaming || !isConnected}
          isSpeaking={isSpeaking}
          onStopSpeaking={() => {
            window.speechSynthesis?.cancel()
            setIsSpeaking(false)
          }}
        />
      </div>
    </div>
  )
}
