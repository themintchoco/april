import { useRef } from 'react'

import cx from 'classnames'
import { PanInfo, motion, useMotionValue } from 'framer-motion'

import styles from './Panel.module.scss'

export enum PanelEntryStyle {
  SlideIn,
  FloatDown,
}

export interface PanelProps {
  allowSwipeAway?: boolean
  onSwipeAway?: () => void
  entryStyle?: PanelEntryStyle
  className?: string
  children?: React.ReactNode
}

const Panel = ({ allowSwipeAway, onSwipeAway, entryStyle, className, children } : PanelProps) => {
  const x = useMotionValue(0)
  const panelDiv = useRef<HTMLDivElement>(null)

  const handlePan = (e: PointerEvent, info: PanInfo) => {
    x.set(Math.max(0, info.offset.x))
  }

  const handlePanEnd = (e: PointerEvent, info: PanInfo) => {
    if (!panelDiv.current) return

    if (info.offset.x + info.velocity.x > panelDiv.current.offsetWidth / 2) {
      onSwipeAway?.()
    } else {
      x.set(0)
    }
  }

  let entryProps = {}
  switch (entryStyle) {
  case PanelEntryStyle.SlideIn:
    entryProps = {
      initial: { x: 400 },
      animate: { x: 0 },
      exit: { x: 400 },
    }
    break
  case PanelEntryStyle.FloatDown:
    entryProps = {
      initial: { y: -10, opacity: 0.9 },
      animate: { y: 0, opacity: 1 },
      exit: { y: -10, opacity: 0.9 },
    }
    break
  }

  return (
    <motion.div
      layout
      ref={panelDiv}
      className={cx(styles.panel, className)}
      {...entryProps}
      style={{ x }}
      transition={{ type: 'spring', bounce: 0 }}
      onPan={allowSwipeAway ? handlePan : undefined}
      onPanEnd={allowSwipeAway ? handlePanEnd : undefined}
    >
      { children }
    </motion.div>
  )
}

export default Panel
