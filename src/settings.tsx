import { createRoot } from 'react-dom/client'

import './styles.css'
import SettingsApp from './SettingsApp'
import { extendTheme, ChakraProvider, type Theme } from '@chakra-ui/react'

const theme: Partial<Theme> = extendTheme({
  config: {
    initialColorMode: 'dark',
    useSystemColorMode: false,
  },
})

createRoot(document.getElementById('root') as HTMLElement).render(
  <ChakraProvider theme={theme}>
    <SettingsApp />
  </ChakraProvider>
)
