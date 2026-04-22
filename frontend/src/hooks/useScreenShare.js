import { useRef, useState, useCallback, useEffect } from 'react'

export default function useScreenShare() {
  const [isSharing, setIsSharing] = useState(false)
  const streamRef = useRef(null)
  const videoRef  = useRef(null)

  const startShare = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always', frameRate: 5 },
        audio: false,
      })

      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }

      stream.getTracks()[0].onended = () => {
        setIsSharing(false)
        streamRef.current = null
      }

      setIsSharing(true)
    } catch (err) {
      if (err.name !== 'NotAllowedError') {
        console.error('getDisplayMedia failed:', err)
      }
    }
  }, [])

  const stopShare = useCallback(() => {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setIsSharing(false)
  }, [])

  const captureFrame = useCallback(() => {
    const video = videoRef.current
    if (!video || !streamRef.current) return null

    const canvas = document.createElement('canvas')
    canvas.width  = video.videoWidth  || 1280
    canvas.height = video.videoHeight || 720
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/png')
  }, [])

  // Sync stream to video element when it becomes available
  useEffect(() => {
    if (isSharing && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current
    }
  }, [isSharing])

  // Clean up on unmount
  useEffect(() => () => stopShare(), [stopShare])

  return { isSharing, startShare, stopShare, captureFrame, videoRef }
}
