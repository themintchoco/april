import { invoke } from '@tauri-apps/api/tauri'
import { currentMonitor } from '@tauri-apps/api/window'

export enum WindowHeight {
  Max = -1,
}

let locked = false
let lastHeight = 0
let timeout: ReturnType<typeof setTimeout> | undefined = undefined

const setWindowHeight = async (height: number | WindowHeight) => {
  const newHeight: number = await invoke('set_height', { height })
  lastHeight = newHeight

  document.querySelector('#root > div')?.setAttribute('style', `${height === WindowHeight.Max || height === newHeight ? 'min' : 'max'}-height: ${newHeight}px;`)
}

export const updateWindowHeight = (height: number) => {
  if (timeout) clearTimeout(timeout)
  if (locked) return

  if (height > lastHeight) {
    void setWindowHeight(height)
  } else if (height < lastHeight) {
    timeout = setTimeout(() => {
      if (locked) return
      void setWindowHeight(height)
    }, 1000)
  }
}

export const lockWindowHeight = async (height: number) => {
  locked = true
  return setWindowHeight(height)
}

export const unlockWindowHeight = () => {
  locked = false
}

export const getMonitorHeight = async () => {
  const monitor = await currentMonitor()
  return monitor?.size.toLogical(monitor.scaleFactor).height ?? 0
}
