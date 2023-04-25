import StatusPanel from './StatusPanel'

export enum ScriptingStatus {
  Idle,
  Scripting,
  Evaluating,
}

export interface ScriptingStatusPanelProps {
  status: ScriptingStatus
}

const ScriptingStatusPanel = ({ status } : ScriptingStatusPanelProps) => {
  return (
    <StatusPanel status={
      status === ScriptingStatus.Scripting ? 'Scripting' :
        status === ScriptingStatus.Evaluating ? 'Evaluating' :
          ''
    } />
  )
}

export default ScriptingStatusPanel
