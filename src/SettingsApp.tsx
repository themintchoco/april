import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/tauri'
import { message, open } from '@tauri-apps/api/dialog'

import { getAll } from 'tauri-settings'
import { Box, Button, Checkbox, CheckboxGroup, Collapse, Divider, Flex, Heading, Input, InputGroup, InputLeftAddon, InputRightElement, Slider, SliderFilledTrack, SliderThumb, SliderTrack, Spacer, Stack, Text } from '@chakra-ui/react'
import { PuffLoader } from 'react-spinners'
import { Secret, TOTP } from 'otpauth'

import styles from './SettingsApp.module.scss'
import { RemindersList } from './@types/commands/reminders'
import { Settings, settingsManager } from './utils/settings'

enum UpdateVenvStatus {
  Idle,
  Loading,
  Errored,
}

const SettingsApp = () => {
  const [loading, setLoading] = useState(false)

  const [credit, setCredit] = useState(0)
  const [invalidCreds, setInvalidCreds] = useState(false)

  const [updateVenvStatus, setUpdateVenvStatus] = useState<[UpdateVenvStatus, string]>([UpdateVenvStatus.Idle, ''])

  const [showToken, setShowToken] = useState(false)
  const [settings, setSettings] = useState<Settings>(settingsManager.default)

  const [reminderLists, setReminderLists] = useState<RemindersList[]>([])

  useEffect(() => {
    void getAll<Settings>('settings')
      .then(({ settings }) => {
        setSettings(settings)
        if (settings.username && settings.token) void updateLogin(settings.username, settings.token)
      })

    void invoke('get_lists')
      .then((listsInfo) => setReminderLists(listsInfo as RemindersList[]))
      .catch((e) => {
        console.error(e)
        void message(e as string, { title: 'An error occured while fetching your reminders lists', type: 'error' })
      })
  }, [])

  const updateLogin = async (username: string, token: string) => {
    const totp = new TOTP({
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: Secret.fromUTF8(token),
    })

    return fetch(`${import.meta.env.VITE_API_URL}/usage`, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${btoa(`${username}:${totp?.generate() ?? ''}`)}`,
      },
    }).then(res => res.json())
      .then(({ credit }) => {
        setCredit(credit as number)
        setInvalidCreds(false)
      })
      .catch((e) => {
        setInvalidCreds(true)
        throw e
      })
  }

  const updateVenv = async (interpreter: string) => {
    setUpdateVenvStatus([UpdateVenvStatus.Loading, 'Initializing Virtual Environment'])

    try {
      await invoke('init_venv', { interpreter })
      setUpdateVenvStatus([UpdateVenvStatus.Idle, 'Successfully Updated Virtual Environment'])
    } catch (e) {
      setUpdateVenvStatus([UpdateVenvStatus.Errored, e as string])
      throw e
    }
  }

  const handleBrowseInterpreter = async () => {
    const selected = await open({
      title: 'Select Python Interpreter',
    })

    if (selected) setSettings({ ...settings, pythonPath: selected as string })
  }

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSettings({ ...settings, username: e.target.value })
  }

  const handleTokenChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSettings({ ...settings, token: e.target.value })
  }

  const handlePythonCustomInterpreterChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSettings({ ...settings, pythonCustomInterpreter: !e.target.checked })
  }

  const handlePythonPathChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSettings({ ...settings, pythonPath: e.target.value })
  }

  const handleRiskAcceptanceChange = (val: number) => {
    setSettings({ ...settings, riskAcceptance: val })
  }

  const handleRemindersListsChange = (val: string[]) => {
    setSettings({ ...settings, remindersLists: val })
  }

  const handleSave = async () => {
    setLoading(true)

    const activePythonPath = settings.pythonCustomInterpreter ? settings.pythonPath : 'python3'
    const shouldUpdateVenv = (await settingsManager.get('pythonCustomInterpreter') ? await settingsManager.get('pythonPath') : 'python3') !== activePythonPath

    try {
      await updateLogin(settings.username, settings.token)
      if (shouldUpdateVenv) await updateVenv(activePythonPath)
    } catch (e) {
      setLoading(false)
      return
    }

    for (const [key, value] of Object.entries(settings)) {
      settingsManager.setCache(key as keyof Settings, value)
    }

    try {
      await settingsManager.syncCache()
    } catch (e) {
      console.error(e)
      void message('', { title: 'An error occured while saving your setttings', type: 'error' })
    }

    setLoading(false)
  }

  const riskAcceptanceProps = [
    { value: 0, label: 'Very Low', desc: 'Your confirmation will be required each time April runs a script.', color: 'teal.400' },
    { value: 24, label: 'Low', desc: 'Your confirmation will not be required for low-risk scripts, as determined by April.', color: 'teal.400' },
    { value: 49, label: 'Medium', desc: 'Your confirmation will not be required for medium-risk scripts, as determined by April.', color: 'red.600' },
    { value: 99, label: 'High', desc: 'Your confirmation will not be required for most scripts.', color: 'maroon' },
    { value: 100, label: 'Very High', desc: 'Your confirmation will not be required for April to run any scripts on your computer. ', color: 'maroon' },
  ].find(({ value }) => value >= settings.riskAcceptance)

  const errorProps = {
    color: 'red.500',
    fontWeight: 'bold',
    fontSize: 'lg',
  }

  return (
    <Flex direction='column' className={styles.settings}>
      <div className={styles.drag} data-tauri-drag-region></div>

      <Flex align='center' gap={4} py={6}>
        <Box className={styles.icon} boxSize={70}></Box>
        <Heading>Settings</Heading>
        <Spacer />
        <Button colorScheme='teal' size='lg' onClick={() => handleSave()} isLoading={loading}>Save</Button>
      </Flex>

      <Divider />

      <Box overflowY='auto' pb={8}>
        <Stack spacing={4} py={8}>
          <Heading size='md'>Account</Heading>

          <InputGroup size='lg'>
            <InputLeftAddon>Username</InputLeftAddon>
            <Input type='text' value={settings.username ?? ''} onChange={handleUsernameChange} />
          </InputGroup>

          <InputGroup size='lg'>
            <InputLeftAddon>Token</InputLeftAddon>
            <Input type={showToken ? 'text' : 'password'} value={settings.token ?? ''} onChange={handleTokenChange} pr='5rem' />
            <InputRightElement width='5rem'>
              <Button h='1.75rem' size='sm' onClick={() => setShowToken((showToken) => !showToken)}>
                {showToken ? 'Hide' : 'Show'}
              </Button>
            </InputRightElement>
          </InputGroup>
        </Stack>

        <Box mb={6}>
          {
            invalidCreds ? (
              <Text {...errorProps}>Invalid credentials</Text>
            ) : (
              <Text>Available credit: ${Math.max(0, credit)}</Text>
            )
          }
        </Box>

        <Divider />

        <Stack spacing={4} py={8}>
          <Heading size='md'>Python</Heading>

          <Stack spacing={4} py={4}>
            <Heading size='sm'>Interpreter</Heading>
            <Checkbox onChange={handlePythonCustomInterpreterChange} isChecked={!settings.pythonCustomInterpreter}>Use default interpreter</Checkbox>

            <Collapse in={settings.pythonCustomInterpreter}>
              <InputGroup size='lg'>
                <InputLeftAddon>Interpreter</InputLeftAddon>
                <Input type='text' value={settings.pythonPath ?? ''} onChange={handlePythonPathChange} pr='5.8rem' />
                <InputRightElement width='5.8rem'>
                  <Button h='1.75rem' size='sm' onClick={() => handleBrowseInterpreter()}>Browse</Button>
                </InputRightElement>
              </InputGroup>
            </Collapse>

            {
              updateVenvStatus[1] && (
                <Flex gap={2}>
                  {
                    updateVenvStatus[0] === UpdateVenvStatus.Loading && (
                      <PuffLoader color='white' size={20} cssOverride={{ top: 1.5 }} />
                    )
                  }
                  <Text {...(updateVenvStatus[0] === UpdateVenvStatus.Errored && errorProps)}>{ updateVenvStatus[1] }</Text>
                </Flex>
              )
            }
          </Stack>

          <Stack spacing={4} py={4}>
            <Heading size='sm'>Risk: { riskAcceptanceProps?.label }</Heading>
            <Text>April may run Python scripts on your computer to resolve your queries. These scripts originate from the Internet and may be malicious. </Text>
            <Text>Before running, April will evaluate the scripts and provide you with an estimated risk rating. You may choose to automatically run scripts by setting a risk threshold. </Text>

            <InputGroup size='lg'>
              <InputLeftAddon>Risk Threshold</InputLeftAddon>
              <Flex gap={4} px={4} align='center' border='1px' borderColor='chakra-border-color' borderRightRadius='md' w='100%'>
                <Slider value={settings.riskAcceptance} onChange={handleRiskAcceptanceChange} focusThumbOnChange={false}>
                  <SliderTrack>
                    <SliderFilledTrack bg={ riskAcceptanceProps?.color } />
                  </SliderTrack>
                  <SliderThumb />
                </Slider>
                <Text flexShrink={0}>{ settings.riskAcceptance }</Text>
              </Flex>
            </InputGroup>

            <Text>{ riskAcceptanceProps?.desc }</Text>
          </Stack>
        </Stack>

        <Divider />

        <Stack spacing={4} py={8}>
          <Heading size='md'>Reminders</Heading>

          <Stack spacing={4} my={4}>
            <Text>Choose lists to share with April. Shared lists can be viewed and modified by April.</Text>

            <Box maxH={50}>
              <CheckboxGroup onChange={handleRemindersListsChange} value={settings.remindersLists}>
                <Stack>
                  {
                    reminderLists.map(({ identifier, title, source, allowsContentModifications }) => (
                      <Checkbox key={identifier} value={identifier} disabled={!allowsContentModifications}>
                        { `${title} (${source})` }
                      </Checkbox>
                    ))
                  }
                </Stack>
              </CheckboxGroup>
            </Box>
          </Stack>
        </Stack>
      </Box>
    </Flex>
  )
}

export default SettingsApp
