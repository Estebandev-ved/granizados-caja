// Prende todo para desarrollar con un solo comando:  npm run dev
// - backend (Spring Boot) en :8080: solo atiende /api, no hay que abrirlo
// - frontend (React + Vite) en :5173: ESTA es la que abres en el navegador
import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'

const win = process.platform === 'win32'
const MORADO = '\x1b[35m', CIAN = '\x1b[36m', NEGRITA = '\x1b[1m', FIN = '\x1b[0m'

if (!existsSync('frontend/node_modules')) {
  console.log('Instalando dependencias del frontend (solo la primera vez)…')
  spawnSync('npm install', { cwd: 'frontend', shell: true, stdio: 'inherit' })
}

const procesos = [
  // PORT fijo: si la terminal trae otra variable PORT, Spring Boot la tomaría (en Railway sí se usa)
  { nombre: 'api', color: MORADO, cmd: (win ? '.\\mvnw.cmd' : './mvnw') + ' -q spring-boot:run', cwd: 'backend', env: { PORT: '8080' } },
  { nombre: 'app', color: CIAN, cmd: 'npm run dev', cwd: 'frontend', env: {} },
].map(p => {
  const hijo = spawn(p.cmd, { cwd: p.cwd, shell: true, env: { ...process.env, FORCE_COLOR: '1', ...p.env } })
  const prefijo = `${p.color}[${p.nombre}]${FIN} `
  const escribir = datos => process.stdout.write(datos.toString().replace(/^(?=.)/gm, prefijo))
  hijo.stdout.on('data', escribir)
  hijo.stderr.on('data', escribir)
  hijo.on('exit', codigo => {
    console.log(`${prefijo}se cerró (código ${codigo})`)
    apagar()
  })
  return hijo
})

console.log(`\n${NEGRITA}🍸 Dopamina Cocktails${FIN}`)
console.log(`   Abre ${NEGRITA}${CIAN}http://localhost:5173${FIN} (PIN de desarrollo: 1234)`)
console.log(`   El backend tarda unos segundos en prender. Ctrl+C para apagar todo.\n`)

let apagando = false
function apagar() {
  if (apagando) return
  apagando = true
  for (const p of procesos) {
    if (p.exitCode !== null) continue
    // En Windows hay que matar el árbol completo (cmd → java / node)
    if (win) spawnSync('taskkill', ['/pid', String(p.pid), '/T', '/F'], { stdio: 'ignore' })
    else p.kill('SIGTERM')
  }
  process.exit(0)
}
process.on('SIGINT', apagar)
process.on('SIGTERM', apagar)
