import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './estilos.css'
import { adoptarTokenDeLaUrl } from './accesoExterno'

// Si llegó desde Antigravity con su token, se guarda antes de pintar la app
adoptarTokenDeLaUrl()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
