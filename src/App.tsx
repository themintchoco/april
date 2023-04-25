import 'regenerator-runtime/runtime'
import { useCallback, useEffect, useRef, useState } from 'react'
import { listen } from '@tauri-apps/api/event'

import { AnimatePresence, Reorder } from 'framer-motion'
import { v4 as uuidv4 } from 'uuid'

import styles from './App.module.scss'
import AprilPanel from './components/AprilPanel'
import CardPanel from './components/CardPanel'
import { PanelInfo, PanelType } from './@types/PanelInfo'
import { WindowHeight, lockWindowHeight, unlockWindowHeight, updateWindowHeight } from './utils/windowHeight'

const App = () => {
  const containerRef = useRef<HTMLDivElement>(null)
  const [panels, setPanels] = useState<PanelInfo[]>([])

  useEffect(() => {
    const unlisten = listen('showApril', () => {
      updateWindowHeight(190)
      handleShowAprilPanel()
    })

    const observer = new ResizeObserver(() => {
      const height = containerRef.current?.lastElementChild?.getBoundingClientRect().bottom ?? 0
      updateWindowHeight(height)
    })

    observer.observe(document.body)

    return () => {
      void unlisten.then((unlisten) => unlisten())
      observer.disconnect()
    }
  }, [])

  const handleShowAprilPanel = useCallback(() => {
    setPanels((panels) => {
      if (panels.some(panel => panel.type === PanelType.April)) return panels
      return [{ type: PanelType.April, id: uuidv4() }, ...panels]
    })
  }, [])

  const handleHideAprilPanel = useCallback(() => {
    setPanels((panels) => panels.filter(panel => panel.type !== PanelType.April))
  }, [])

  const handleNewCard = useCallback((stream: ReadableStream<string>) => {
    setPanels((panels) => [...panels, { type: PanelType.Card, id: uuidv4(), stream }])
  }, [])

  const handleRemovePanel = useCallback((id: string) => {
    setPanels((panels) => panels.filter(panel => panel.id !== id))
  }, [])

  const handleDragPanelStart = useCallback(() => {
    void lockWindowHeight(WindowHeight.Max)
  }, [])

  const handleDragPanelEnd = useCallback(() => {
    unlockWindowHeight()

    const height = containerRef.current?.lastElementChild?.getBoundingClientRect().bottom ?? 0
    updateWindowHeight(height)
  }, [])

  return (
    <Reorder.Group className={styles.main} as='div' axis='y' values={panels} onReorder={setPanels} ref={containerRef}>
      <AnimatePresence>
        {
          panels.map((panelInfo: PanelInfo) => {
            let panel
            switch (panelInfo.type) {
            case PanelType.April:
              panel = (
                <AprilPanel
                  onNewCard={handleNewCard}
                  onCancel={handleHideAprilPanel}
                />
              )
              break
            case PanelType.Card:
              panel = (
                <CardPanel
                  stream={panelInfo.stream}
                  onClose={() => handleRemovePanel(panelInfo.id)}
                />
              )
              break
            }

            return (
              <Reorder.Item as='div' key={panelInfo.id} value={panelInfo} onDragStart={handleDragPanelStart} onDragEnd={handleDragPanelEnd}>
                { panel }
              </Reorder.Item>
            )
          })
        }
      </AnimatePresence>
    </Reorder.Group>
  )
}

export default App
