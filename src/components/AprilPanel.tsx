import { useEffect, useRef, useState } from 'react'
import { fetch as tauriFetch, ResponseType } from '@tauri-apps/api/http'
import { invoke } from '@tauri-apps/api/tauri'
import { message } from '@tauri-apps/api/dialog'
import { type as osType } from '@tauri-apps/api/os'

import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition'
import cx from 'classnames'
import google from 'googlethis'
import { AnimatePresence } from 'framer-motion'
import { AxiosRequestConfig } from 'axios'
import { Secret, TOTP } from 'otpauth'
import { v4 as uuidv4 } from 'uuid'
import * as chrono from 'chrono-node'

import styles from './AprilPanel.module.scss'
import CodeEvaluationPanel from './CodeEvaluationPanel'
import Markdown from './Markdown'
import Panel, { PanelEntryStyle } from './Panel'
import ScriptingStatusPanel, { ScriptingStatus } from './ScriptingStatusPanel'
import SpeechWave from './SpeechWave'
import StatusPanel from './StatusPanel'
import useAudioQueue from '../hooks/useAudioQueue'
import useStreamingData from '../hooks/useStreamingData'
import { Message, RequestPayload, ResponsePayloadType } from '../@types/April'
import { PanelInfo, PanelType } from '../@types/PanelInfo'
import { Reminder, RemindersList } from '../@types/commands/reminders'
import { getMonitorHeight } from '../utils/windowHeight'
import { settingsManager } from '../utils/settings'
export interface AprilPanelProps {
  onNewCard?: (stream: ReadableStream<string>) => void
  onCancel?: () => void
}

const AprilPanel = ({ onNewCard, onCancel } : AprilPanelProps) => {
  const [sessionId] = useState(() => uuidv4())
  const [username, setUsername] = useState<string>()
  const [totp, setTotp] = useState<TOTP>()

  const [messages, setMessages] = useState<Message[]>([])
  const [messagesMaxHeight, setMessagesMaxHeight] = useState(0)
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  const [listening, setListening] = useState(false)
  const [aprilResponse, aprilResponseStream, resetAprilResponse] = useStreamingData()

  const [panels, setPanels] = useState<PanelInfo[]>([])

  const { play } = useAudioQueue()

  const { transcript, resetTranscript } = useSpeechRecognition()

  useEffect(() => {
    const handleAudioStart = () => {
      setListening(true)
      messagesContainerRef.current?.scrollTo({
        top: messagesContainerRef.current?.scrollHeight,
        left: 0,
        behavior: 'smooth',
      })
    }

    const handleAudioEnd = () => {
      setListening(false)
    }

    void settingsManager.get('username')
      .then((username) => setUsername(username))

    void settingsManager.get('token')
      .then((token) => setTotp(new TOTP({
        algorithm: 'SHA1',
        digits: 6,
        period: 30,
        secret: Secret.fromUTF8(token),
      })))

    void getMonitorHeight()
      .then((height) => setMessagesMaxHeight(height / 3))

    const recognition = SpeechRecognition.getRecognition()

    recognition?.addEventListener('audiostart', handleAudioStart)
    recognition?.addEventListener('audioend', handleAudioEnd)

    void SpeechRecognition.startListening()

    return () => {
      recognition?.removeEventListener('audiostart', handleAudioStart)
      recognition?.removeEventListener('audioend', handleAudioEnd)

      SpeechRecognition.abortListening()
    }
  }, [])

  useEffect(() => {
    if (!transcript) return

    const timeout = setTimeout(() => {
      SpeechRecognition.abortListening()
      resetTranscript()

      void handleSubmit(transcript)
    }, 1500)

    return () => {
      clearTimeout(timeout)
    }
  }, [transcript])

  const newStatus = (status: string, loading = true) => {
    setPanels((panels) => [...panels, { type: PanelType.Status, id: uuidv4(), status, loading }])
  }

  const updateScriptingStatus = (status: ScriptingStatus) => {
    setPanels((panels) => {
      if (status === ScriptingStatus.Idle) return panels.filter((panel) => panel.type !== PanelType.ScriptingStatus)

      const panel = panels.find((panel) => panel.type === PanelType.ScriptingStatus)
      if (panel?.type === PanelType.ScriptingStatus) {
        panel.status = status
        return [...panels]
      }

      return [{ type: PanelType.ScriptingStatus, id: uuidv4(), status }, ...panels]
    })
  }

  const handleVoice = (data: string) => {
    console.log('handleVoice')
    play(`data:audio/mp3;base64,${data}`)
    return []
  }

  const handleSearch = async (query: string) => {
    console.log('handleSearch:', query)
    newStatus(`Searching for ${query}`)

    const result = await google.search(query, {
      parse_ads: false,
    }, async (url: string, options?: AxiosRequestConfig) => {
      const headers = Object.fromEntries(Object.entries(options?.headers as { [k: string]: unknown }).map(([k, v]) => [k, String(v)]))

      try {
        const response = await tauriFetch<string>(url, {
          method: 'GET',
          responseType: ResponseType.Text,
          headers
        })

        if (!response.ok) throw new Error('not ok')

        return { data: response.data }
      } catch (e) {
        console.error('error', e)
        return { data: '' }
      }
    })

    return [
      {
        type: 'search',
        data: {
          query,
          info: JSON.stringify(result),
        },
      },
    ]
  }

  const handleBrowse = async (url: string) => {
    console.log('handleBrowse:', url)
    newStatus(`Accessing ${url}`)

    const response = await tauriFetch<string>(url, {
      method: 'GET',
      responseType: ResponseType.Text,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.4 Safari/605.1.15',
      },
    })

    const data = new DOMParser().parseFromString(response.data, 'text/html')
    data.querySelectorAll('script, style').forEach((el) => el.remove())
    const textContent = data.body.textContent ?? ''

    return [
      {
        type: 'browse',
        data: {
          url,
          info: textContent,
        }
      }
    ]
  }

  const handlePython = async (code: string, riskAccepted = false) => {
    if (!riskAccepted && await settingsManager.get('riskAcceptance') < 100) {
      console.log('handlePython: using handlePythonWithEvaluation instead')
      return []
    }

    console.log('handlePython:', code)
    updateScriptingStatus(ScriptingStatus.Idle)

    try {
      const [exitCode, output, error] = await invoke('python_run', { code }) as [number, string, string]
      console.log(exitCode, output, error)

      return [
        {
          type: 'python',
          data: { exitCode, output, error },
        },
      ]
    } catch (e) {
      console.error(e)
      void message(e as string, { title: 'Python Error', type: 'error' })
      return []
    }
  }

  const handlePythonWithEvaluation = async (args: string) => {
    console.log('handlePythonWithEvaluation:', args)
    updateScriptingStatus(ScriptingStatus.Idle)

    const promptUser = () => {
      let resolve: (accept: boolean | PromiseLike<boolean>) => void
      const promise = new Promise<boolean>((res) => { resolve = res })

      setPanels((panels) => [...panels, { type: PanelType.CodeEvaluation, id: uuidv4(), rating, review, resolve }])

      return promise
    }

    const [ratingString, review, ...code] = args.split('\n')
    const rating = Math.max(0, parseInt(ratingString))

    if (rating < await settingsManager.get('riskAcceptance') || await promptUser()) {
      return handlePython(code.join('\n'), true)
    }

    return [
      {
        type: 'python',
        data: { exitCode: 1, error: 'The user decided to not run the script' },
      }
    ]
  }

  const handlePip = async (args: string) => {
    console.log('handlePip:', args)

    try {
      const [exitCode, output, error] = await invoke('python_pip', { args }) as [number, string, string]
      console.log(exitCode, output, error)

      return [
        {
          type: 'python',
          data: { exitCode, output, error },
        },
      ]
    } catch (e) {
      console.error(e)
      void message(e as string, { title: 'Python Error', type: 'error' })
      return []
    }
  }

  const handleOpen = async (args: string) => {
    console.log('handleOpen:', args)

    const [file_or_app, ...name] = args.split(' ')

    try {
      const [exitCode, output, error] = await invoke('open_app', { [file_or_app === 'app' ? 'appName' : 'file']: name.join(' ') }) as [number, string, string]
      console.log(exitCode, output, error)

      return [
        {
          type: 'open',
          data: { exitCode, output, error },
        },
      ]
    } catch (e) {
      console.error(e)
      void message(e as string, { title: 'Open Error', type: 'error' })
      return []
    }
  }

  const handleReminders = async (args: string) => {
    console.log('handleReminders:', args)

    const handleRemindersLists = async () => {
      const enabledLists = await invoke<RemindersList[]>('get_enabled_lists')
      if (enabledLists.length === 0) throw 'No lists enabled'

      return enabledLists.map(({ title }) => title)
    }

    const handleRemindersSearch = async (query: string) => {
      return {
        query,
        reminders: await invoke<Reminder[]>('get_reminders', { onlyIncomplete: true }),
      }
    }

    const handleRemindersNew = async (args: string) => {
      const [listName, dueDate, ...content] = args.split('\n')

      const parseResult = chrono.parse(dueDate)[0]
      const parsedDueDate = (parseResult.end ?? parseResult.start).date().getTime() / 1000

      return invoke<string>('add_to_list', {
        listName,
        dueDate: parsedDueDate,
        title: content.join('\n'),
      })
    }

    const handleRemindersDelete = async (identifier: string) => {
      await invoke('delete_reminder', { identifier })
      return true
    }

    const [subcommand] = args.split(/\s/, 1)
    let result: unknown

    try {
      switch (subcommand) {
      case 'lists':
        result = await handleRemindersLists()
        break
      case 'search':
        result = await handleRemindersSearch(args.slice(subcommand.length + 1))
        newStatus('Searching reminders')
        break
      case 'new':
        result = await handleRemindersNew(args.slice(subcommand.length + 1))
        break
      case 'delete':
        result = await handleRemindersDelete(args.slice(subcommand.length + 1))
        break
      default:
        throw 'Invalid subcommand'
      }
    } catch (e) {
      console.error(e)
      return [
        {
          type: 'reminders',
          data: { error: { [subcommand]: e as string } },
        }
      ]
    }

    return [
      {
        type: 'reminders',
        data: { [subcommand]: result },
      }
    ]
  }

  const handleUnknownCommand = (args: string) => {
    console.log('handleUnknownCommand:', args)

    return [
      {
        type: 'unknown',
        data: args,
      }
    ]
  }

  const handleCommandStream = (command: ResponsePayloadType, commandStream: ReadableStream<string>) => {
    let resolveResult: (result: RequestPayload[] | PromiseLike<RequestPayload[]>) => void
    const promise = new Promise<RequestPayload[]>((resolve) => {
      resolveResult = resolve
    })

    let handleCommand: ((s: string) => RequestPayload[] | Promise<RequestPayload[]>) | undefined

    switch (command) {
    case ResponsePayloadType.Voice:
      handleCommand = handleVoice
      break
    case ResponsePayloadType.Search:
      handleCommand = handleSearch
      break
    case ResponsePayloadType.Browse:
      handleCommand = handleBrowse
      break
    case ResponsePayloadType.Python:
      handleCommand = handlePython
      updateScriptingStatus(ScriptingStatus.Scripting)
      break
    case ResponsePayloadType.PythonWithEvaluation:
      handleCommand = handlePythonWithEvaluation
      updateScriptingStatus(ScriptingStatus.Evaluating)
      break
    case ResponsePayloadType.Pip:
      handleCommand = handlePip
      break
    case ResponsePayloadType.Open:
      handleCommand = handleOpen
      break
    case ResponsePayloadType.Card:
      onNewCard?.(commandStream)
      return []
    case ResponsePayloadType.Reminders:
      handleCommand = handleReminders
      break
    case ResponsePayloadType.Unknown:
      handleCommand = handleUnknownCommand
      break
    default:
      return
    }

    let buf = ''
    void commandStream.pipeTo(new WritableStream({
      write(chunk: string) {
        buf += chunk
      },
      async close() {
        const result = await handleCommand?.(buf) ?? []
        resolveResult(result)
      },
    }))

    return promise
  }

  const handleSubmit = async (message: string) => {
    console.log('handleSubmit:', message)

    const newMessages: Message[] = []

    if (aprilResponse) newMessages.push({ role: 'assistant', content: aprilResponse })
    newMessages.push({ role: 'user', content: message })

    resetAprilResponse()
    setMessages((messages) => [...messages, ...newMessages])

    const responses: RequestPayload[] = [
      { type: 'response', data: message },
    ]

    let requireFollowUp = false
    while (responses.length > 0) {
      console.log('Sending', responses)

      const response = await fetch(import.meta.env.VITE_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${btoa(`${username ?? ''}:${totp?.generate() ?? ''}`)}`,
          'X-APIVersion': '3',
          'X-Session': sessionId,
          'X-OperatingSystem': await osType(),
          'X-AcceptRisk': await settingsManager.get('riskAcceptance') === 100 ? 'true' : 'false',
        },
        body: JSON.stringify(responses)
      })

      responses.length = 0
      setPanels([])

      if (response.status >= 400) {
        throw new Error('Bad response from server')
      } else if (!response.body) {
        throw new Error('Empty response from server')
      }

      const writers = [aprilResponseStream.getWriter()]
      const results: (RequestPayload[] | Promise<RequestPayload[]>)[] = []

      await response.body
        .pipeThrough(new TextDecoderStream())
        .pipeTo(new WritableStream({
          async write(chunk) {
            const [prevPayload, ...nextPayloads] = chunk.split('\0')
            await writers.at(-1)?.ready
            await writers.at(-1)?.write(prevPayload)

            for (const nextPayload of nextPayloads) {
              const payloadType = nextPayload[0] as ResponsePayloadType
              const payloadData = nextPayload.slice(1)

              if (payloadType !== ResponsePayloadType.Voice) // Voice payload does not terminate previous payload
                if (writers.length > 1) await writers.pop()?.close()

              if (payloadType === ResponsePayloadType.FollowUp) {
                requireFollowUp = true
              } else {
                const { readable, writable } = new TransformStream<string, string>()
                const result = handleCommandStream(payloadType, readable)

                if (result) {
                  results.push(result)
                  writers.push(writable.getWriter())
                }
              }

              await writers.at(-1)?.ready
              await writers.at(-1)?.write(payloadData)
            }
          },
          async close() {
            await Promise.all(writers.splice(1).map((writer) => writer.close()))
            writers[0].releaseLock()

            responses.push(...(await Promise.all(results)).flat())
          }
        }))
    }

    if (requireFollowUp) void SpeechRecognition.startListening()
  }

  const toggleListening = () => {
    if (listening) void SpeechRecognition.stopListening()
    else void SpeechRecognition.startListening()
  }

  return (
    <>
      <Panel allowSwipeAway entryStyle={PanelEntryStyle.SlideIn} onSwipeAway={onCancel}>
        <div className={styles.messagesContainer} style={{ maxHeight: messagesMaxHeight }} ref={messagesContainerRef}>
          {
            [...Array(Math.floor(messages.length / 2)) as undefined[]].map((_, i) => (
              <div key={i}>
                {
                  [0, 1].map((j) => (
                    <Markdown key={j} className={cx(styles.message, {
                      [styles.userMessage]: messages[i * 2 + j].role === 'user',
                      [styles.assistantMessage]: messages[i * 2 + j].role === 'assistant',
                    })}>
                      { messages[i * 2 + j].content }
                    </Markdown>
                  ))
                }
              </div>
            ))
          }

          <div>
            {
              messages.slice(-1).map((message) => (
                <Markdown key={-1} className={cx(styles.message, {
                  [styles.userMessage]: message.role === 'user',
                  [styles.assistantMessage]: message.role === 'assistant',
                })}>
                  { message.content }
                </Markdown>
              ))
            }

            {
              aprilResponse && (
                <Markdown className={cx(styles.message, styles.assistantMessage)}>{ aprilResponse }</Markdown>
              )
            }

            {
              messages.length === 0 && transcript === '' ? (
                <p className={styles.placeholder}>How can I help?</p>
              ) : listening && (
                <p className={cx(styles.message, styles.userMessage)}>{ transcript }</p>
              )
            }
          </div>
        </div>

        <SpeechWave listening={listening} height={60} onClick={toggleListening} />
      </Panel>

      <AnimatePresence>
        {
          panels.map((panelInfo) => {
            switch (panelInfo.type) {
            case PanelType.ScriptingStatus:
              return (
                <ScriptingStatusPanel key={panelInfo.id} {...panelInfo} />
              )
            case PanelType.Status:
              return (
                <StatusPanel key={panelInfo.id} {...panelInfo} />
              )
            case PanelType.CodeEvaluation:
              return (
                <CodeEvaluationPanel key={panelInfo.id} {...panelInfo} />
              )
            }
          })
        }
      </AnimatePresence>
    </>
  )
}

export default AprilPanel
