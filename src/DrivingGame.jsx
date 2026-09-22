import { useCallback, useEffect, useRef, useState } from 'react'
import './DrivingGame.css'

const WIDTH = 420
const HEIGHT = 620
const ROAD_LEFT = 62
const ROAD_RIGHT = WIDTH - 62
const PLAYER_Y = HEIGHT - 92
const PLAYER_W = 42
const PLAYER_H = 74
const START_SPEED = 220
const MAX_SPEED = 520
const MAX_HEALTH = 3
const START_FUEL = 100

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
const random = (min, max) => min + Math.random() * (max - min)

function loadBest() {
  try {
    return Number(localStorage.getItem('y9-driving-best') || 0)
  } catch {
    return 0
  }
}

function environmentFor(score) {
  if (score >= 3000) return 'rain'
  if (score >= 1500) return 'night'
  if (score >= 500) return 'highway'
  return 'city'
}

function createObstacle(score) {
  const difficulty = clamp(score / 3000, 0, 1)
  const roll = Math.random()
  let kind = 'car'

  if (roll < 0.16 + difficulty * 0.04) kind = 'truck'
  else if (roll < 0.27) kind = 'cone'
  else if (roll < 0.34 + difficulty * 0.06) kind = 'barrier'
  else if (roll < 0.42 + difficulty * 0.07) kind = 'police'

  const dimensions = {
    car: [40, 70],
    truck: [48, 92],
    cone: [28, 34],
    barrier: [62, 30],
    police: [44, 74],
  }[kind]

  return {
    id: Math.random().toString(36).slice(2),
    kind,
    x: random(ROAD_LEFT + dimensions[0] / 2 + 8, ROAD_RIGHT - dimensions[0] / 2 - 8),
    y: -dimensions[1] - random(10, 130),
    w: dimensions[0],
    h: dimensions[1],
    speedOffset: kind === 'truck' ? -35 : kind === 'cone' || kind === 'barrier' ? 75 : random(-15, 45),
    nearMissed: false,
  }
}

function createPickup() {
  const kinds = ['coin', 'fuel', 'repair']
  const weights = Math.random()
  const kind = weights < 0.55 ? kinds[0] : weights < 0.82 ? kinds[1] : kinds[2]
  return {
    id: Math.random().toString(36).slice(2),
    kind,
    x: random(ROAD_LEFT + 28, ROAD_RIGHT - 28),
    y: -35,
    r: kind === 'coin' ? 12 : 15,
  }
}

function rectsOverlap(a, b) {
  return (
    a.x - a.w / 2 < b.x + b.w / 2 &&
    a.x + a.w / 2 > b.x - b.w / 2 &&
    a.y - a.h / 2 < b.y + b.h / 2 &&
    a.y + a.h / 2 > b.y - b.h / 2
  )
}

function roundedRect(ctx, x, y, w, h, radius) {
  const r = Math.min(radius, w / 2, h / 2)
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
  ctx.fill()
}

function drawCar(ctx, x, y, w, h, player = false, kind = 'car') {
  ctx.save()
  ctx.translate(x, y)

  if (kind === 'cone') {
    ctx.fillStyle = '#ff922b'
    ctx.beginPath()
    ctx.moveTo(0, -h / 2)
    ctx.lineTo(-w / 2, h / 2)
    ctx.lineTo(w / 2, h / 2)
    ctx.closePath()
    ctx.fill()
    ctx.fillStyle = '#fff3bf'
    ctx.fillRect(-w * 0.34, h * 0.08, w * 0.68, 5)
    ctx.restore()
    return
  }

  if (kind === 'barrier') {
    ctx.fillStyle = '#e9ecef'
    roundedRect(ctx, -w / 2, -h / 2, w, h, 5)
    ctx.fillStyle = '#e03131'
    for (let i = -w / 2 + 6; i < w / 2; i += 18) {
      ctx.save()
      ctx.translate(i, 0)
      ctx.rotate(-0.45)
      ctx.fillRect(-3, -h / 2, 7, h)
      ctx.restore()
    }
    ctx.restore()
    return
  }

  const body = player
    ? '#339af0'
    : kind === 'police'
      ? '#f8f9fa'
      : kind === 'truck'
        ? '#f59f00'
        : '#ff6b6b'

  ctx.fillStyle = 'rgba(0, 0, 0, 0.28)'
  roundedRect(ctx, -w / 2 + 3, -h / 2 + 5, w, h, 9)
  ctx.fillStyle = body
  roundedRect(ctx, -w / 2, -h / 2, w, h, 9)

  if (kind === 'police') {
    ctx.fillStyle = '#1864ab'
    ctx.fillRect(-w / 2, -5, w, 10)
    ctx.fillStyle = '#fa5252'
    ctx.fillRect(-10, -h / 2 + 8, 9, 5)
    ctx.fillStyle = '#228be6'
    ctx.fillRect(1, -h / 2 + 8, 9, 5)
  }

  ctx.fillStyle = 'rgba(210, 240, 255, 0.72)'
  roundedRect(ctx, -w * 0.32, -h * 0.27, w * 0.64, h * 0.24, 4)
  ctx.fillStyle = 'rgba(10, 20, 35, 0.45)'
  roundedRect(ctx, -w * 0.3, h * 0.02, w * 0.6, h * 0.2, 4)

  ctx.fillStyle = '#fff3bf'
  ctx.fillRect(-w * 0.32, -h / 2 + 4, w * 0.18, 5)
  ctx.fillRect(w * 0.14, -h / 2 + 4, w * 0.18, 5)

  if (player) {
    ctx.fillStyle = '#ffec99'
    ctx.fillRect(-w * 0.3, h / 2 - 9, w * 0.16, 5)
    ctx.fillRect(w * 0.14, h / 2 - 9, w * 0.16, 5)
  }

  ctx.restore()
}

export default function DrivingGame({ onBack }) {
  const canvasRef = useRef(null)
  const frameRef = useRef(null)
  const keysRef = useRef(new Set())
  const targetXRef = useRef(WIDTH / 2)
  const playerXRef = useRef(WIDTH / 2)
  const statusRef = useRef('ready')
  const scoreRef = useRef(0)
  const healthRef = useRef(MAX_HEALTH)
  const fuelRef = useRef(START_FUEL)
  const obstaclesRef = useRef([])
  const pickupsRef = useRef([])
  const speedRef = useRef(START_SPEED)
  const obstacleTimerRef = useRef(0)
  const pickupTimerRef = useRef(2.5)
  const roadOffsetRef = useRef(0)
  const boostRef = useRef(0)
  const invulnerableRef = useRef(0)
  const pausedRef = useRef(false)
  const lastTimeRef = useRef(null)
  const bestRef = useRef(loadBest())

  const [status, setStatus] = useState('ready')
  const [score, setScore] = useState(0)
  const [health, setHealth] = useState(MAX_HEALTH)
  const [fuel, setFuel] = useState(START_FUEL)
  const [best, setBest] = useState(bestRef.current)
  const [environment, setEnvironment] = useState('city')
  const [message, setMessage] = useState('Move the mouse to steer')

  const saveBest = useCallback((value) => {
    if (value <= bestRef.current) return
    bestRef.current = value
    setBest(value)
    try {
      localStorage.setItem('y9-driving-best', String(value))
    } catch {
      // localStorage can be unavailable in private/locked-down contexts.
    }
  }, [])

  const resetGame = useCallback(() => {
    targetXRef.current = WIDTH / 2
    playerXRef.current = WIDTH / 2
    scoreRef.current = 0
    healthRef.current = MAX_HEALTH
    fuelRef.current = START_FUEL
    obstaclesRef.current = []
    pickupsRef.current = []
    speedRef.current = START_SPEED
    obstacleTimerRef.current = 0.25
    pickupTimerRef.current = 2.6
    roadOffsetRef.current = 0
    boostRef.current = 0
    invulnerableRef.current = 0
    lastTimeRef.current = null
    statusRef.current = 'ready'
    setScore(0)
    setHealth(MAX_HEALTH)
    setFuel(START_FUEL)
    setEnvironment('city')
    setMessage('Move the mouse to steer')
    setStatus('ready')
  }, [])

  const startGame = useCallback(() => {
    resetGame()
    statusRef.current = 'playing'
    setStatus('playing')
    setMessage('')
  }, [resetGame])

  const endGame = useCallback((reason) => {
    statusRef.current = 'gameover'
    const finalScore = Math.floor(scoreRef.current)
    saveBest(finalScore)
    setStatus('gameover')
    setMessage(reason)
  }, [saveBest])

  const triggerBoost = useCallback(() => {
    if (statusRef.current === 'ready') startGame()
    if (statusRef.current !== 'playing') return
    if (fuelRef.current < 8) return
    boostRef.current = 0.8
    fuelRef.current = Math.max(0, fuelRef.current - 8)
    setFuel(Math.round(fuelRef.current))
  }, [startGame])

  useEffect(() => {
    const handleKeyDown = (event) => {
      keysRef.current.add(event.key.toLowerCase())
      if (event.code === 'Space') {
        event.preventDefault()
        if (statusRef.current === 'gameover') startGame()
        else triggerBoost()
      }
    }
    const handleKeyUp = (event) => keysRef.current.delete(event.key.toLowerCase())
    const handleVisibility = () => {
      pausedRef.current = document.hidden
      lastTimeRef.current = null
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [startGame, triggerBoost])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const ctx = canvas.getContext('2d')

    const pointerToRoad = (clientX) => {
      const rect = canvas.getBoundingClientRect()
      const x = ((clientX - rect.left) / rect.width) * WIDTH
      targetXRef.current = clamp(x, ROAD_LEFT + PLAYER_W / 2 + 4, ROAD_RIGHT - PLAYER_W / 2 - 4)
      if (statusRef.current === 'ready') {
        statusRef.current = 'playing'
        setStatus('playing')
        setMessage('')
      }
    }

    const onPointerMove = (event) => pointerToRoad(event.clientX)
    const onPointerDown = (event) => {
      pointerToRoad(event.clientX)
      if (event.pointerType === 'mouse' && event.button === 0) triggerBoost()
    }

    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('contextmenu', (event) => event.preventDefault())

    return () => {
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerdown', onPointerDown)
    }
  }, [triggerBoost])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const ctx = canvas.getContext('2d')

    const drawRoad = (env) => {
      const palettes = {
        city: { side: '#495057', road: '#343a40', line: '#f8f9fa', accent: '#ffd43b', sky: '#868e96' },
        highway: { side: '#2b8a3e', road: '#343a40', line: '#f8f9fa', accent: '#ffd43b', sky: '#69db7c' },
        night: { side: '#111827', road: '#1f2937', line: '#dbeafe', accent: '#fbbf24', sky: '#0f172a' },
        rain: { side: '#263238', road: '#263238', line: '#d8f3dc', accent: '#ffd43b', sky: '#17202a' },
      }
      const p = palettes[env]
      ctx.fillStyle = p.sky
      ctx.fillRect(0, 0, WIDTH, HEIGHT)
      ctx.fillStyle = p.side
      ctx.fillRect(0, 0, ROAD_LEFT, HEIGHT)
      ctx.fillRect(ROAD_RIGHT, 0, WIDTH - ROAD_RIGHT, HEIGHT)
      ctx.fillStyle = p.road
      ctx.fillRect(ROAD_LEFT, 0, ROAD_RIGHT - ROAD_LEFT, HEIGHT)

      ctx.fillStyle = p.accent
      ctx.fillRect(ROAD_LEFT + 5, 0, 4, HEIGHT)
      ctx.fillRect(ROAD_RIGHT - 9, 0, 4, HEIGHT)

      const laneWidth = (ROAD_RIGHT - ROAD_LEFT) / 3
      const dashH = 44
      const gap = 34
      const cycle = dashH + gap
      const offset = roadOffsetRef.current % cycle
      ctx.fillStyle = p.line
      for (let lane = 1; lane < 3; lane += 1) {
        const x = ROAD_LEFT + laneWidth * lane
        for (let y = -cycle + offset; y < HEIGHT + cycle; y += cycle) {
          ctx.globalAlpha = 0.72
          ctx.fillRect(x - 2, y, 4, dashH)
        }
      }
      ctx.globalAlpha = 1

      if (env === 'city') {
        for (let y = -70 + (roadOffsetRef.current * 0.35) % 90; y < HEIGHT; y += 90) {
          ctx.fillStyle = '#adb5bd'
          ctx.fillRect(10, y, 32, 54)
          ctx.fillRect(WIDTH - 42, y + 24, 32, 54)
          ctx.fillStyle = '#ffe066'
          ctx.fillRect(16, y + 10, 7, 8)
          ctx.fillRect(WIDTH - 34, y + 34, 7, 8)
        }
      }

      if (env === 'night' || env === 'rain') {
        const glow = ctx.createRadialGradient(WIDTH / 2, PLAYER_Y - 70, 20, WIDTH / 2, PLAYER_Y - 70, 230)
        glow.addColorStop(0, 'rgba(255, 244, 190, 0.14)')
        glow.addColorStop(1, 'rgba(0, 0, 0, 0)')
        ctx.fillStyle = glow
        ctx.fillRect(ROAD_LEFT, 0, ROAD_RIGHT - ROAD_LEFT, HEIGHT)
      }

      if (env === 'rain') {
        ctx.strokeStyle = 'rgba(210, 235, 255, 0.36)'
        ctx.lineWidth = 1.5
        for (let i = 0; i < 35; i += 1) {
          const x = (i * 71 + roadOffsetRef.current * 1.7) % WIDTH
          const y = (i * 97 + roadOffsetRef.current * 2.2) % HEIGHT
          ctx.beginPath()
          ctx.moveTo(x, y)
          ctx.lineTo(x - 7, y + 18)
          ctx.stroke()
        }
      }
    }

    const drawPickup = (pickup) => {
      ctx.save()
      ctx.translate(pickup.x, pickup.y)
      if (pickup.kind === 'coin') {
        ctx.fillStyle = '#ffd43b'
        ctx.beginPath()
        ctx.arc(0, 0, pickup.r, 0, Math.PI * 2)
        ctx.fill()
        ctx.strokeStyle = '#f08c00'
        ctx.lineWidth = 3
        ctx.stroke()
        ctx.fillStyle = '#7c5200'
        ctx.font = 'bold 13px system-ui'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('$', 0, 1)
      } else if (pickup.kind === 'fuel') {
        ctx.fillStyle = '#51cf66'
        roundedRect(ctx, -12, -15, 24, 30, 5)
        ctx.fillStyle = '#f8f9fa'
        ctx.fillRect(-6, -9, 12, 6)
        ctx.fillStyle = '#1b4332'
        ctx.font = 'bold 12px system-ui'
        ctx.textAlign = 'center'
        ctx.fillText('F', 0, 10)
      } else {
        ctx.fillStyle = '#f8f9fa'
        roundedRect(ctx, -15, -15, 30, 30, 6)
        ctx.fillStyle = '#fa5252'
        ctx.fillRect(-4, -10, 8, 20)
        ctx.fillRect(-10, -4, 20, 8)
      }
      ctx.restore()
    }

    const render = () => {
      const env = environmentFor(scoreRef.current)
      drawRoad(env)

      pickupsRef.current.forEach(drawPickup)
      obstaclesRef.current.forEach((obstacle) => drawCar(ctx, obstacle.x, obstacle.y, obstacle.w, obstacle.h, false, obstacle.kind))

      const blink = invulnerableRef.current > 0 && Math.floor(invulnerableRef.current * 12) % 2 === 0
      if (!blink) drawCar(ctx, playerXRef.current, PLAYER_Y, PLAYER_W, PLAYER_H, true)

      if (boostRef.current > 0) {
        ctx.fillStyle = 'rgba(51, 154, 240, 0.18)'
        ctx.fillRect(ROAD_LEFT, 0, ROAD_RIGHT - ROAD_LEFT, HEIGHT)
      }

      if (statusRef.current !== 'playing') {
        ctx.fillStyle = 'rgba(8, 15, 25, 0.5)'
        ctx.fillRect(0, 0, WIDTH, HEIGHT)
        ctx.fillStyle = '#fff'
        ctx.textAlign = 'center'
        ctx.font = '900 34px system-ui'
        ctx.fillText(statusRef.current === 'gameover' ? 'RUN OVER' : 'HIGHWAY ESCAPE', WIDTH / 2, HEIGHT / 2 - 18)
        ctx.font = '700 16px system-ui'
        ctx.fillText(statusRef.current === 'gameover' ? 'Press Play again' : 'Move the mouse or drag to start', WIDTH / 2, HEIGHT / 2 + 20)
      }
    }

    const update = (delta) => {
      if (statusRef.current !== 'playing' || pausedRef.current) return

      const keys = keysRef.current
      if (keys.has('a') || keys.has('arrowleft')) targetXRef.current -= 290 * delta
      if (keys.has('d') || keys.has('arrowright')) targetXRef.current += 290 * delta
      targetXRef.current = clamp(targetXRef.current, ROAD_LEFT + PLAYER_W / 2 + 4, ROAD_RIGHT - PLAYER_W / 2 - 4)

      const smoothing = 1 - Math.pow(0.0008, delta)
      playerXRef.current += (targetXRef.current - playerXRef.current) * smoothing

      if (boostRef.current > 0) boostRef.current = Math.max(0, boostRef.current - delta)
      if (invulnerableRef.current > 0) invulnerableRef.current = Math.max(0, invulnerableRef.current - delta)

      speedRef.current = Math.min(MAX_SPEED, speedRef.current + 9 * delta)
      const actualSpeed = speedRef.current * (boostRef.current > 0 ? 1.45 : 1)
      roadOffsetRef.current += actualSpeed * delta
      scoreRef.current += actualSpeed * delta * 0.085
      fuelRef.current = Math.max(0, fuelRef.current - delta * (boostRef.current > 0 ? 2.5 : 0.7))

      obstacleTimerRef.current -= delta
      pickupTimerRef.current -= delta

      const spawnRate = Math.max(0.42, 1.05 - scoreRef.current / 5500)
      if (obstacleTimerRef.current <= 0) {
        obstaclesRef.current.push(createObstacle(scoreRef.current))
        obstacleTimerRef.current = spawnRate * random(0.78, 1.24)
      }

      if (pickupTimerRef.current <= 0) {
        pickupsRef.current.push(createPickup())
        pickupTimerRef.current = random(4, 7)
      }

      const player = { x: playerXRef.current, y: PLAYER_Y, w: PLAYER_W * 0.82, h: PLAYER_H * 0.86 }
      const survivingObstacles = []

      for (const obstacle of obstaclesRef.current) {
        const next = { ...obstacle, y: obstacle.y + (actualSpeed + obstacle.speedOffset) * delta }
        const obstacleRect = { x: next.x, y: next.y, w: next.w * 0.86, h: next.h * 0.86 }

        if (rectsOverlap(player, obstacleRect) && invulnerableRef.current <= 0) {
          healthRef.current -= 1
          setHealth(healthRef.current)
          invulnerableRef.current = 1.15
          speedRef.current = Math.max(START_SPEED, speedRef.current - 70)
          if (healthRef.current <= 0) {
            endGame('Your car is wrecked')
            break
          }
          continue
        }

        if (!next.nearMissed && next.y > PLAYER_Y + next.h / 2 + 4) {
          const sideGap = Math.abs(next.x - player.x) - (next.w + player.w) / 2
          if (sideGap > 0 && sideGap < 18) {
            next.nearMissed = true
            scoreRef.current += 80
          }
        }

        if (next.y < HEIGHT + 120) survivingObstacles.push(next)
      }
      obstaclesRef.current = survivingObstacles

      const survivingPickups = []
      for (const pickup of pickupsRef.current) {
        const next = { ...pickup, y: pickup.y + actualSpeed * delta }
        const dx = next.x - player.x
        const dy = next.y - player.y
        if (Math.hypot(dx, dy) < next.r + PLAYER_W * 0.36) {
          if (next.kind === 'coin') scoreRef.current += 120
          if (next.kind === 'fuel') fuelRef.current = Math.min(100, fuelRef.current + 34)
          if (next.kind === 'repair') healthRef.current = Math.min(MAX_HEALTH, healthRef.current + 1)
          setHealth(healthRef.current)
          continue
        }
        if (next.y < HEIGHT + 50) survivingPickups.push(next)
      }
      pickupsRef.current = survivingPickups

      if (fuelRef.current <= 0) endGame('Out of fuel')

      const roundedScore = Math.floor(scoreRef.current)
      setScore(roundedScore)
      setFuel(Math.round(fuelRef.current))
      const nextEnv = environmentFor(scoreRef.current)
      setEnvironment((current) => (current === nextEnv ? current : nextEnv))
    }

    const loop = (time) => {
      if (lastTimeRef.current == null) lastTimeRef.current = time
      const delta = Math.min((time - lastTimeRef.current) / 1000, 0.05)
      lastTimeRef.current = time
      update(delta)
      render()
      frameRef.current = requestAnimationFrame(loop)
    }

    frameRef.current = requestAnimationFrame(loop)
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current)
    }
  }, [endGame])

  return (
    <section className="screen driving-screen">
      <div className="driving-shell">
        <div className="driving-header">
          <button className="secondary-button" type="button" onClick={onBack}>← Back</button>
          <h2>Highway Escape</h2>
          <div className="score-pill driving-best">Best: {best}</div>
        </div>

        <div className="driving-hud">
          <span>Score <strong>{score}</strong></span>
          <span>❤️ {health}/{MAX_HEALTH}</span>
          <span>⛽ {fuel}%</span>
          <span className="driving-env">{environment.toUpperCase()}</span>
        </div>

        <canvas
          ref={canvasRef}
          className="driving-canvas"
          width={WIDTH}
          height={HEIGHT}
          aria-label={`Highway Escape. Score ${score}. Health ${health}. Fuel ${fuel} percent.`}
        />

        <div className="driving-actions">
          {status === 'gameover' ? (
            <button className="primary-button" type="button" onClick={startGame}>Play again</button>
          ) : (
            <>
              <button className="primary-button" type="button" onClick={status === 'ready' ? startGame : triggerBoost}>
                {status === 'ready' ? 'Start' : 'Boost'}
              </button>
              <button className="secondary-button" type="button" onClick={resetGame}>Restart</button>
            </>
          )}
        </div>

        {message && <div className="driving-message">{message}</div>}
        <p className="driving-help">🖱️ Move mouse / drag to steer · Click or Space to boost · A/D also steer</p>
      </div>
    </section>
  )
}
