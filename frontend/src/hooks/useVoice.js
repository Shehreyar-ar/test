import { useRef, useState, useCallback, useEffect } from 'react'

export default function useVoice({ onResult, onInterim }) {
  const [isListening, setIsListening] = useState(false)
  const [interimTranscript, setInterimTranscript] = useState('')
  const recognitionRef = useRef(null)
  const onResultRef = useRef(onResult)
  const onInterimRef = useRef(onInterim)

  useEffect(() => { onResultRef.current = onResult  }, [onResult])
  useEffect(() => { onInterimRef.current = onInterim }, [onInterim])

  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) {
      alert('Speech recognition is not supported in this browser. Use Chrome or Edge.')
      return
    }

    const recognition = new SR()
    recognition.lang = 'en-US'
    recognition.interimResults = true
    recognition.continuous = false
    recognition.maxAlternatives = 1

    recognition.onstart = () => setIsListening(true)

    recognition.onresult = (event) => {
      let interim = ''
      let final = ''
      for (const result of event.results) {
        if (result.isFinal) final += result[0].transcript
        else interim += result[0].transcript
      }
      if (interim) {
        setInterimTranscript(interim)
        onInterimRef.current?.(interim)
      }
      if (final) {
        setInterimTranscript('')
        onInterimRef.current?.('')
        onResultRef.current?.(final.trim())
      }
    }

    recognition.onerror = (e) => {
      if (e.error !== 'no-speech') console.warn('SpeechRecognition error:', e.error)
      setIsListening(false)
      setInterimTranscript('')
    }

    recognition.onend = () => {
      setIsListening(false)
      setInterimTranscript('')
    }

    recognitionRef.current = recognition
    recognition.start()
  }, [])

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop()
    setIsListening(false)
    setInterimTranscript('')
  }, [])

  return { isListening, interimTranscript, startListening, stopListening }
}
