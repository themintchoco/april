import { SettingsManager } from 'tauri-settings'

export interface Settings {
  username: string
  token: string
  pythonCustomInterpreter: boolean
  pythonPath: string
  riskAcceptance: number
  remindersLists: string[]
}

export const settingsManager = new SettingsManager<Settings>({
  username: '',
  token: '',
  pythonCustomInterpreter: false,
  pythonPath: 'python3',
  riskAcceptance: 0,
  remindersLists: []
})

void settingsManager.initialize()
