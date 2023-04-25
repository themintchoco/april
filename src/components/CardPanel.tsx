import { useEffect } from 'react'

import styles from './CardPanel.module.scss'
import Markdown from './Markdown'
import Panel, { PanelEntryStyle } from './Panel'
import useStreamingData from '../hooks/useStreamingData'

export interface CardPanelProps {
  stream: ReadableStream
  onClose?: () => void
}

const CardPanel = ({ stream, onClose } : CardPanelProps) => {
  const [heading, headingStream] = useStreamingData()
  const [bigText, bigTextStream] = useStreamingData()
  const [smallText, smallTextStream] = useStreamingData()

  useEffect(() => {
    const writers = [headingStream, bigTextStream, smallTextStream].map(stream => stream.getWriter())

    void stream.pipeTo(new WritableStream({
      write(chunk: string) {
        const [prevLines, ...nextLines] = chunk.split('\n')
        void writers[0].write(prevLines)

        for (const line of nextLines) {
          writers.shift()?.releaseLock()
          void writers[0].write(line)
        }
      },
      close() {
        writers[0].releaseLock()
      },
    }))
  }, [])

  return (
    <Panel allowSwipeAway entryStyle={PanelEntryStyle.SlideIn} onSwipeAway={onClose} className={styles.panel}>
      <p className={styles.heading}>{ heading }</p>
      <h1 className={styles.bigText}>{ bigText }</h1>
      <Markdown>{ smallText }</Markdown>
    </Panel>
  )
}

export default CardPanel
