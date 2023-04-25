import { useCallback, useEffect, useState } from 'react'

const useAudioQueue = () => {
  const [audio] = useState(() => new Audio())
  const [current, setCurrent] = useState<string | null>(null)
  const [queue, setQueue] = useState<string[]>([])

  useEffect(() => {
    const handleEnded = () => {
      setCurrent(null)
    }

    audio.addEventListener('ended', handleEnded)

    return () => {
      audio.removeEventListener('ended', handleEnded)
    }
  }, [])

  useEffect(() => {
    if (!current && queue.length > 0) {
      const next = queue[0]
      if (next) {
        setCurrent(next)
        audio.src = next
        void audio.play()
      }

      setQueue((queue) => queue.slice(1))
    }
  }, [current, queue])

  const play = useCallback((src: string) => {
    setQueue((queue) => [...queue, src])
  }, [])

  return { play }
}

export default useAudioQueue
