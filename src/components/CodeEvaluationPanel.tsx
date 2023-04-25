import cx from 'classnames'

import styles from './CodeEvaluationPanel.module.scss'
import Panel, { PanelEntryStyle } from './Panel'

export interface CodeEvaluationPanelProps {
  rating: number
  review: string
  resolve: (allow: boolean) => void
}

const CodeEvaluationPanel = ({ review, resolve } : CodeEvaluationPanelProps) => {
  return (
    <Panel entryStyle={PanelEntryStyle.FloatDown}>
      <b className={styles.heading}>Allow April to run script?</b>
      <span className={styles.message}>{ review }</span>

      <div className={styles.btnContainer}>
        <div className={cx(styles.btn, styles.allowBtn)} onClick={() => resolve(true)}>Allow</div>
        <div className={cx(styles.btn, styles.denyBtn)} onClick={() => resolve(false)}>Deny</div>
      </div>
    </Panel>
  )
}

export default CodeEvaluationPanel
