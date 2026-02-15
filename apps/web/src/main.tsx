import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './styles/globals.css'
import './i18n'
import { loadFont } from './utils/fontLoader'

// Load only the default font at boot (others loaded on demand when user picks them)
loadFont('plus-jakarta-sans')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
)

// Register service worker in production (enables PWA install)
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Silent fail — SW is optional, app works without it
    })
  })
}
