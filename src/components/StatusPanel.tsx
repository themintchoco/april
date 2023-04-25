import { PuffLoader } from 'react-spinners'

import styles from './StatusPanel.module.scss'
import Panel, { PanelEntryStyle } from './Panel'

export interface StatusPanelProps {
  status: string
  loading?: boolean
}

const StatusPanel = ({ status, loading } : StatusPanelProps) => {
  return (
    <Panel entryStyle={PanelEntryStyle.FloatDown} className={styles.panel}>
      <PuffLoader loading={loading} color='white' size={15} cssOverride={{ top: -3 }} />
      <span>{ status }</span>
    </Panel>
  )
}

export default StatusPanel
