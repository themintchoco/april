import { ComponentProps, useEffect, useRef, useState } from 'react'

import SiriWave from 'siriwave'

export interface SpeechWaveProps extends ComponentProps<'div'> {
  listening: boolean
  height: number
  amplitude?: number
}

const SpeechWave = ({ listening, height, amplitude = 3, ...props } : SpeechWaveProps) => {
  const [wave, setWave] = useState<SiriWave>()
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let siriWave: SiriWave

    setTimeout(() => {
      if (!containerRef.current) return

      siriWave = new SiriWave({
        container: containerRef.current,
        style: 'ios9',
        autostart: true,
        amplitude: 0,
      })

      setWave(siriWave)
    }, 500)

    return () => {
      siriWave.dispose()
    }
  }, [])

  useEffect(() => {
    if (listening) wave?.setAmplitude(amplitude)
    else wave?.setAmplitude(0)
  }, [listening])

  return (
    <div ref={containerRef} style={{ height }} {...props}></div>
  )
}

export default SpeechWave
