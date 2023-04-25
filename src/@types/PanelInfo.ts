import { ScriptingStatus } from '../components/ScriptingStatusPanel'

export enum PanelType {
  April,
  Card,
  CodeEvaluation,
  Status,
  ScriptingStatus,
}

interface BasePanelInfo {
  type: PanelType
  id: string
}

export interface AprilPanelInfo extends BasePanelInfo {
  type: PanelType.April
}

export interface CardPanelInfo extends BasePanelInfo {
  type: PanelType.Card
  stream: ReadableStream<string>
}

export interface CodeEvaluationPanelInfo extends BasePanelInfo {
  type: PanelType.CodeEvaluation
  rating: number
  review: string
  resolve: (allow: boolean) => void
}

export interface StatusPanelInfo extends BasePanelInfo {
  type: PanelType.Status
  status: string
  loading: boolean
}

export interface ScriptingStatusPanelInfo extends BasePanelInfo {
  type: PanelType.ScriptingStatus
  status: ScriptingStatus
}

export type PanelInfo = (
  AprilPanelInfo |
  CardPanelInfo |
  CodeEvaluationPanelInfo |
  StatusPanelInfo |
  ScriptingStatusPanelInfo
)
