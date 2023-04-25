import { useCallback, useEffect, useState } from 'react'

const useStreamingData = (): [string, WritableStream<string>, () => void] => {
  const [state, setState] = useState('')
  const [writableStream] = useState<WritableStream<string>>(() => {
    return new WritableStream<string>({
      write: (chunk) => {
        setState((state) => state + chunk)
      },
    })
  })

  useEffect(() => {
    return () => {
      void writableStream.close()
    }
  }, [])

  const reset = useCallback(() => {
    setState('')
  }, [])

  return [state, writableStream, reset]
}

export default useStreamingData
