import { useCallback, useEffect, useRef, useState } from 'react'
import './DrivingGame.css'

const WIDTH = 420
const HEIGHT = 620
const ROAD_LEFT = 62
const ROAD_RIGHT = WIDTH - 62
const PLAYER_Y = HEIGHT / 2 + 68
const PLAYER_W = 42
const PLAYER_H = 74

const START_SPEED = 100
const MAX_SPEED = 215
const MIN_SPEED = 62
const MAX_HEALTH = 3
const START_BOOST_FUEL = 100
const PURSUIT_START_SCORE = 2000
const POLICE_MAX_HEALTH = 3
const POLICE_DESIRED_DISTANCE = 135

const ROAD_SCROLL_SCALE = 3.15
const TRAFFIC_SCROLL_SCALE = 3.15

const laneWidth = (ROAD_RIGHT - ROAD_LEFT) / 3
const LANE_CENTERS = [
  ROAD_LEFT + laneWidth * 0.5,
  ROAD_LEFT + laneWidth * 1.5,
  ROAD_LEFT + laneWidth * 2.5,
]

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
const random = (min, max) => min + Math.random() * (max - min)
const randomItem = (items) => items[Math.floor(Math.random() * items.length)]

function loadBest() {
  try {
    return Number(localStorage.getItem('y9-driving-best') || 0)
  } catch {
    return 0
  }
}

function environmentFor(score) {
  if (score >= PURSUIT_START_SCORE) return 'pursuit'
  if (score >= 3000) return 'rain'
  if (score >= 1500) return 'night'
  if (score >= 500) return 'highway'
  return 'city'
}

function targetCruiseSpeed(score) {
  return clamp(100 + Math.min(score, 5000) * 0.016, 100, 180)
}

function dimensionsFor(kind) {
  return {
    car: [40, 70],
    fast: [40, 70],
    truck: [48, 92],
    police: [44, 74],
    cone: [28, 34],
    barrier: [62, 30],
  }[kind]
}

function trafficSpeedFor(kind, playerSpeed) {
  if (kind === 'truck') return random(playerSpeed * 0.56, playerSpeed * 0.72)
  if (kind === 'fast') return random(playerSpeed * 0.76, playerSpeed * 0.92)
  if (kind === 'police') return playerSpeed + random(6, 12)
  return random(playerSpeed * 0.62, playerSpeed * 0.82)
}

function createTrafficVehicle(score, playerSpeed, lane, options = {}) {
  const difficulty = clamp(score / 5000, 0, 1)
  const roll = Math.random()

  let kind = options.kind
  if (!kind) {
    if (roll < 0.16 + difficulty * 0.05) kind = 'truck'
    else if (roll < 0.34 + difficulty * 0.08) kind = 'fast'
    else kind = 'car'
  }

  const [w, h] = dimensionsFor(kind)
  const spawnY = options.y ?? -h - random(40, 140)

  return {
    id: Math.random().toString(36).slice(2),
    kind,
    lane,
    targetLane: lane,
    x: LANE_CENTERS[lane],
    y: spawnY,
    w,
    h,
    speed: options.speed ?? trafficSpeedFor(kind, playerSpeed),
    nearMissed: false,
    overtaken: false,
    aiTimer: kind === 'truck' ? random(4.5, 8) : random(2.4, 6),
    laneState: 'cruise',
    indicatorTimer: 0,
    indicatorDirection: 0,
    braking: false,
    rearSpawn: Boolean(options.rearSpawn),
    police: kind === 'police',
    pursuitOffset: options.pursuitOffset ?? 0,
    reactionTimer: options.reactionTimer ?? 0,
    policeHealth: POLICE_MAX_HEALTH,
  }
}

function createRoadHazard(kind, lane, y = -120) {
  const [w, h] = dimensionsFor(kind)
  return {
    id: Math.random().toString(36).slice(2),
    kind,
    lane,
    targetLane: lane,
    x: LANE_CENTERS[lane],
    y,
    w,
    h,
    speed: 0,
    nearMissed: false,
    overtaken: false,
    aiTimer: 999,
    laneState: 'cruise',
    indicatorTimer: 0,
    indicatorDirection: 0,
    braking: false,
    rearSpawn: false,
    police: false,
  }
}

function createTrafficBatch(score, playerSpeed) {
  const batch = []
  const baseY = -random(70, 150)
  const patternRoll = Math.random()

  if (score >= 700 && patternRoll < 0.22) {
    const openLane = Math.floor(Math.random() * 3)
    const occupied = [0, 1, 2].filter((lane) => lane !== openLane)

    occupied.forEach((lane, index) => {
      batch.push(
        createTrafficVehicle(score, playerSpeed, lane, {
          y: baseY - index * random(10, 32),
          kind: Math.random() < 0.28 ? 'truck' : 'car',
        }),
      )
    })

    return batch
  }

  if (score >= 1500 && patternRoll < 0.34) {
    const firstLane = Math.floor(Math.random() * 3)
    const possibleSecond = [0, 1, 2].filter((lane) => lane !== firstLane)
    const secondLane = randomItem(possibleSecond)

    batch.push(
      createTrafficVehicle(score, playerSpeed, firstLane, {
        y: baseY,
        kind: 'truck',
      }),
    )

    batch.push(
      createTrafficVehicle(score, playerSpeed, secondLane, {
        y: baseY - random(115, 150),
        kind: Math.random() < 0.55 ? 'fast' : 'car',
      }),
    )

    return batch
  }

  if (score >= 5000 && patternRoll < 0.46) {
    const openLane = Math.floor(Math.random() * 3)
    const blocked = [0, 1, 2].filter((lane) => lane !== openLane)

    blocked.forEach((lane) => {
      batch.push(createRoadHazard('barrier', lane, baseY))
    })

    return batch
  }

  batch.push(
    createTrafficVehicle(
      score,
      playerSpeed,
      Math.floor(Math.random() * 3),
      { y: baseY },
    ),
  )

  return batch
}

function createRearFastCar(score, playerSpeed) {
  const lane = Math.floor(Math.random() * 3)
  return createTrafficVehicle(score, playerSpeed, lane, {
    kind: 'fast',
    rearSpawn: true,
    y: HEIGHT + 110,
    speed: Math.min(MAX_SPEED + 12, playerSpeed + random(8, 18)),
  })
}

function createPoliceCar(playerSpeed, lane = Math.floor(Math.random() * 3)) {
  return createTrafficVehicle(PURSUIT_START_SCORE, playerSpeed, lane, {
    kind: 'police',
    rearSpawn: true,
    y: PLAYER_Y + POLICE_DESIRED_DISTANCE,
    speed: Math.min(MAX_SPEED + 18, playerSpeed + random(12, 20)),
    pursuitOffset: Math.random() < 0.5 ? -55 : 55,
    reactionTimer: 0.6,
  })
}

function createPickup() {
  const roll = Math.random()
  const kind = roll < 0.56 ? 'coin' : roll < 0.82 ? 'fuel' : 'repair'
  return {
    id: Math.random().toString(36).slice(2),
    kind,
    x: LANE_CENTERS[Math.floor(Math.random() * 3)] + random(-18, 18),
    y: -45,
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

function resolveTrafficSpacing(vehicles, playerSpeed) {
  const ordered = [...vehicles].sort((first, second) => first.y - second.y)

  for (let index = 1; index < ordered.length; index += 1) {
    const vehicle = ordered[index]
    const ahead = ordered[index - 1]
    const sharesPath =
      vehicle.lane === ahead.lane ||
      vehicle.lane === ahead.targetLane ||
      vehicle.targetLane === ahead.lane ||
      vehicle.targetLane === ahead.targetLane

    if (!sharesPath) continue

    const horizontalGap = Math.abs(vehicle.x - ahead.x)
    const minimumHorizontalGap = (vehicle.w + ahead.w) * 0.42
    const minimumVerticalGap = (vehicle.h + ahead.h) / 2 + 12

    if (horizontalGap < minimumHorizontalGap && vehicle.y - ahead.y < minimumVerticalGap) {
      const overlap = minimumVerticalGap - (vehicle.y - ahead.y)
      vehicle.y += Math.min(overlap, 10)
      vehicle.speed = Math.min(
        vehicle.speed,
        ahead.speed,
        Math.max(0, playerSpeed - 8),
      )
      vehicle.braking = true
    }
  }

  return ordered
}

function roundedRect(ctx, x, y, w, h, radius) {
  const r = Math.min(radius, w / 2, h / 2)
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
  ctx.fill()
}

function drawVehicle(ctx, vehicle, player = false) {
  const { x, y, w, h, kind } = vehicle

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
        : kind === 'fast'
          ? '#9775fa'
          : '#ff6b6b'

  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)'
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

  if (vehicle.braking && !player) {
    ctx.fillStyle = 'rgba(255, 40, 40, 0.75)'
    ctx.fillRect(-w * 0.32, h * 0.36, w * 0.16, 4)
    ctx.fillRect(w * 0.16, h * 0.36, w * 0.16, 4)
  }

  if (vehicle.police) {
    const flash = Math.floor(performance.now() / 130) % 2
    ctx.globalAlpha = 0.35
    ctx.fillStyle = flash ? '#ff3333' : '#3388ff'
    ctx.beginPath()
    ctx.arc(flash ? -8 : 8, -h * 0.05, 12, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
  }

  if (vehicle.laneState === 'indicating') {
    const blinkOn = Math.floor(vehicle.indicatorTimer * 8) % 2 === 0
    if (blinkOn) {
      ctx.fillStyle = '#ffa94d'
      const indicatorX = vehicle.indicatorDirection < 0 ? -w / 2 + 4 : w / 2 - 8
      ctx.fillRect(indicatorX, h / 2 - 10, 5, 6)
    }
  }

  ctx.restore()
}

function laneIsClear(vehicle, lane, vehicles) {
  return !vehicles.some((other) => {
    if (other.id === vehicle.id) return false
    if (other.kind === 'cone' || other.kind === 'barrier') return false

    const occupiesLane =
      other.lane === lane ||
      other.targetLane === lane

    return occupiesLane && Math.abs(other.y - vehicle.y) < 118
  })
}

export default function DrivingGame({ onBack, onScoreSubmit }) {
  const canvasRef = useRef(null)
  const frameRef = useRef(null)
  const keysRef = useRef(new Set())

  const targetXRef = useRef(WIDTH / 2)
  const playerXRef = useRef(WIDTH / 2)

  const statusRef = useRef('ready')
  const scoreRef = useRef(0)
  const healthRef = useRef(MAX_HEALTH)
  const boostFuelRef = useRef(START_BOOST_FUEL)
  const speedRef = useRef(START_SPEED)
  const multiplierRef = useRef(1)

  const trafficRef = useRef([])
  const pickupsRef = useRef([])

  const trafficTimerRef = useRef(0)
  const pickupTimerRef = useRef(2.5)
  const rearCarTimerRef = useRef(8)
  const policeTimerRef = useRef(5)
  const pursuitWarningRef = useRef(0)
  const policeDamageCooldownRef = useRef(0)
  const escapeRef = useRef(0)

  const roadOffsetRef = useRef(0)
  const invulnerableRef = useRef(0)
  const pausedRef = useRef(false)
  const lastTimeRef = useRef(null)
  const bestRef = useRef(loadBest())

  const boostSourcesRef = useRef(new Set())
  const brakeSourcesRef = useRef(new Set())

  const comboTimerRef = useRef(0)
  const nearMissWindowRef = useRef({ time: 0, side: 0 })
  const messageTimerRef = useRef(0)
  const hudTimerRef = useRef(0)

  const [status, setStatus] = useState('ready')
  const [score, setScore] = useState(0)
  const [health, setHealth] = useState(MAX_HEALTH)
  const [boostFuel, setBoostFuel] = useState(START_BOOST_FUEL)
  const [speed, setSpeed] = useState(START_SPEED)
  const [multiplier, setMultiplier] = useState(1)
  const [best, setBest] = useState(bestRef.current)
  const [environment, setEnvironment] = useState('city')
  const [message, setMessage] = useState('Move the mouse to steer')
  const [escape, setEscape] = useState(0)
  const [policeHealth, setPoliceHealth] = useState(POLICE_MAX_HEALTH)
  const [pursuitWarning, setPursuitWarning] = useState(0)

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

  const setControlSource = useCallback((ref, source, active) => {
    if (active) ref.current.add(source)
    else ref.current.delete(source)
  }, [])

  const showMessage = useCallback((text, duration = 1.25) => {
    setMessage(text)
    messageTimerRef.current = duration
  }, [])

  const resetGame = useCallback(() => {
    targetXRef.current = WIDTH / 2
    playerXRef.current = WIDTH / 2

    scoreRef.current = 0
    healthRef.current = MAX_HEALTH
    boostFuelRef.current = START_BOOST_FUEL
    speedRef.current = START_SPEED
    multiplierRef.current = 1

    trafficRef.current = []
    pickupsRef.current = []

    trafficTimerRef.current = 0.2
    pickupTimerRef.current = 3.5
    rearCarTimerRef.current = 8
    policeTimerRef.current = 6
    pursuitWarningRef.current = 0
    policeDamageCooldownRef.current = 0
    escapeRef.current = 0

    roadOffsetRef.current = 0
    invulnerableRef.current = 0
    comboTimerRef.current = 0
    nearMissWindowRef.current = { time: 0, side: 0 }
    messageTimerRef.current = 0
    hudTimerRef.current = 0

    boostSourcesRef.current.clear()
    brakeSourcesRef.current.clear()

    lastTimeRef.current = null
    statusRef.current = 'ready'

    setScore(0)
    setHealth(MAX_HEALTH)
    setBoostFuel(START_BOOST_FUEL)
    setSpeed(START_SPEED)
    setMultiplier(1)
    setEnvironment('city')
    setMessage('Move the mouse to steer')
    setEscape(0)
    setPoliceHealth(POLICE_MAX_HEALTH)
    setPursuitWarning(0)
    setStatus('ready')
  }, [])

  const startGame = useCallback(() => {
    resetGame()
    statusRef.current = 'playing'
    setStatus('playing')
    setMessage('')
  }, [resetGame])

  const endGame = useCallback((reason) => {
    if (statusRef.current === 'gameover') return

    statusRef.current = 'gameover'
    boostSourcesRef.current.clear()
    brakeSourcesRef.current.clear()

    const finalScore = Math.floor(scoreRef.current)
    saveBest(finalScore)
    onScoreSubmit?.('driving', finalScore)

    setStatus('gameover')
    setMessage(reason)
  }, [onScoreSubmit, saveBest])

  const startBoost = useCallback((source) => {
    if (statusRef.current === 'ready') startGame()
    if (statusRef.current !== 'playing') return
    setControlSource(boostSourcesRef, source, true)
  }, [setControlSource, startGame])

  const stopBoost = useCallback((source) => {
    setControlSource(boostSourcesRef, source, false)
  }, [setControlSource])

  const startBrake = useCallback((source) => {
    if (statusRef.current === 'ready') startGame()
    if (statusRef.current !== 'playing') return
    setControlSource(brakeSourcesRef, source, true)
  }, [setControlSource, startGame])

  const stopBrake = useCallback((source) => {
    setControlSource(brakeSourcesRef, source, false)
  }, [setControlSource])

  useEffect(() => {
    const handleKeyDown = (event) => {
      const key = event.key.toLowerCase()
      keysRef.current.add(key)

      if (event.code === 'Space' || event.key === 'Shift') {
        event.preventDefault()

        if (statusRef.current === 'gameover') {
          startGame()
          return
        }

        startBoost('keyboard')
      }

      if (key === 's' || event.key === 'ArrowDown') {
        event.preventDefault()
        startBrake('keyboard')
      }
    }

    const handleKeyUp = (event) => {
      const key = event.key.toLowerCase()
      keysRef.current.delete(key)

      if (event.code === 'Space' || event.key === 'Shift') {
        stopBoost('keyboard')
      }

      if (key === 's' || event.key === 'ArrowDown') {
        stopBrake('keyboard')
      }
    }

    const handleVisibility = () => {
      pausedRef.current = document.hidden
      lastTimeRef.current = null

      if (document.hidden) {
        boostSourcesRef.current.clear()
        brakeSourcesRef.current.clear()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [startBoost, startBrake, startGame, stopBoost, stopBrake])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined

    const pointerToRoad = (clientX) => {
      const rect = canvas.getBoundingClientRect()
      const x = ((clientX - rect.left) / rect.width) * WIDTH

      targetXRef.current = clamp(
        x,
        ROAD_LEFT + PLAYER_W / 2 + 4,
        ROAD_RIGHT - PLAYER_W / 2 - 4,
      )

      if (statusRef.current === 'ready') {
        statusRef.current = 'playing'
        setStatus('playing')
        setMessage('')
      }
    }

    const onPointerMove = (event) => {
      pointerToRoad(event.clientX)
    }

    const onPointerDown = (event) => {
      pointerToRoad(event.clientX)

      if (event.pointerType === 'mouse') {
        if (event.button === 0) startBoost('mouse')
        if (event.button === 2) startBrake('mouse')
      }

      if (canvas.setPointerCapture) {
        try {
          canvas.setPointerCapture(event.pointerId)
        } catch {
          // Ignore browsers that reject capture for this pointer.
        }
      }
    }

    const onPointerUp = (event) => {
      if (event.pointerType === 'mouse') {
        if (event.button === 0) stopBoost('mouse')
        if (event.button === 2) stopBrake('mouse')
      }

      if (canvas.releasePointerCapture) {
        try {
          canvas.releasePointerCapture(event.pointerId)
        } catch {
          // Pointer capture may already be released.
        }
      }
    }

    const onPointerCancel = () => {
      stopBoost('mouse')
      stopBrake('mouse')
    }

    const onContextMenu = (event) => {
      event.preventDefault()
    }

    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointercancel', onPointerCancel)
    canvas.addEventListener('contextmenu', onContextMenu)

    return () => {
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerCancel)
      canvas.removeEventListener('contextmenu', onContextMenu)
    }
  }, [startBoost, startBrake, stopBoost, stopBrake])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined

    const ctx = canvas.getContext('2d')

    const drawRoad = (env) => {
      const palettes = {
        city: {
          side: '#495057',
          road: '#343a40',
          line: '#f8f9fa',
          accent: '#ffd43b',
          sky: '#868e96',
        },
        highway: {
          side: '#2b8a3e',
          road: '#343a40',
          line: '#f8f9fa',
          accent: '#ffd43b',
          sky: '#69db7c',
        },
        night: {
          side: '#111827',
          road: '#1f2937',
          line: '#dbeafe',
          accent: '#fbbf24',
          sky: '#0f172a',
        },
        rain: {
          side: '#263238',
          road: '#263238',
          line: '#d8f3dc',
          accent: '#ffd43b',
          sky: '#17202a',
        },
        pursuit: {
          side: '#111827',
          road: '#202631',
          line: '#e5e7eb',
          accent: '#fbbf24',
          sky: '#090d18',
        },
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
        for (
          let y = -70 + (roadOffsetRef.current * 0.35) % 90;
          y < HEIGHT;
          y += 90
        ) {
          ctx.fillStyle = '#adb5bd'
          ctx.fillRect(10, y, 32, 54)
          ctx.fillRect(WIDTH - 42, y + 24, 32, 54)

          ctx.fillStyle = '#ffe066'
          ctx.fillRect(16, y + 10, 7, 8)
          ctx.fillRect(WIDTH - 34, y + 34, 7, 8)
        }
      }

      if (env === 'night' || env === 'rain' || env === 'pursuit') {
        const glow = ctx.createRadialGradient(
          WIDTH / 2,
          PLAYER_Y - 70,
          20,
          WIDTH / 2,
          PLAYER_Y - 70,
          230,
        )

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

      if (env === 'pursuit') {
        const pulse = (Math.sin(performance.now() / 120) + 1) / 2

        ctx.fillStyle = `rgba(255, 45, 45, ${0.03 + pulse * 0.04})`
        ctx.fillRect(0, 0, WIDTH / 2, HEIGHT)

        ctx.fillStyle = `rgba(40, 125, 255, ${0.03 + (1 - pulse) * 0.04})`
        ctx.fillRect(WIDTH / 2, 0, WIDTH / 2, HEIGHT)
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
        ctx.fillText('B', 0, 10)
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

      trafficRef.current.forEach((vehicle) => {
        drawVehicle(ctx, vehicle, false)
      })

      const blink =
        invulnerableRef.current > 0 &&
        Math.floor(invulnerableRef.current * 12) % 2 === 0

      if (!blink) {
        drawVehicle(
          ctx,
          {
            x: playerXRef.current,
            y: PLAYER_Y,
            w: PLAYER_W,
            h: PLAYER_H,
            kind: 'car',
            braking: brakeSourcesRef.current.size > 0,
            laneState: 'cruise',
            indicatorTimer: 0,
            indicatorDirection: 0,
          },
          true,
        )
      }

      if (
        boostSourcesRef.current.size > 0 &&
        boostFuelRef.current > 0 &&
        statusRef.current === 'playing'
      ) {
        ctx.fillStyle = 'rgba(51, 154, 240, 0.14)'
        ctx.fillRect(ROAD_LEFT, 0, ROAD_RIGHT - ROAD_LEFT, HEIGHT)

        ctx.strokeStyle = 'rgba(160, 215, 255, 0.25)'
        ctx.lineWidth = 2

        for (let i = 0; i < 12; i += 1) {
          const x = ROAD_LEFT + ((i * 43 + roadOffsetRef.current) % (ROAD_RIGHT - ROAD_LEFT))
          const y = (i * 89 + roadOffsetRef.current * 1.8) % HEIGHT

          ctx.beginPath()
          ctx.moveTo(x, y)
          ctx.lineTo(x, y + 28)
          ctx.stroke()
        }
      }

      if (statusRef.current !== 'playing') {
        ctx.fillStyle = 'rgba(8, 15, 25, 0.5)'
        ctx.fillRect(0, 0, WIDTH, HEIGHT)

        ctx.fillStyle = '#fff'
        ctx.textAlign = 'center'
        ctx.font = '900 34px system-ui'
        ctx.fillText(
          statusRef.current === 'gameover'
            ? 'RUN OVER'
            : 'HIGHWAY ESCAPE',
          WIDTH / 2,
          HEIGHT / 2 - 18,
        )

        ctx.font = '700 16px system-ui'
        ctx.fillText(
          statusRef.current === 'gameover'
            ? 'Press Play again'
            : 'Move the mouse or drag to start',
          WIDTH / 2,
          HEIGHT / 2 + 20,
        )
      }
    }

    const rewardOvertake = (vehicle, nearMiss) => {
      if (vehicle.overtaken) return

      vehicle.overtaken = true

      const base = nearMiss ? 25 : 10
      const reward = Math.round(base * multiplierRef.current)

      scoreRef.current += reward
      multiplierRef.current = clamp(
        multiplierRef.current + (nearMiss ? 0.22 : 0.08),
        1,
        5,
      )
      comboTimerRef.current = 3.2

      if (!nearMiss) {
        showMessage(`OVERTAKE +${reward}`)
        return
      }

      const side = vehicle.x < playerXRef.current ? -1 : 1
      const recent = nearMissWindowRef.current

      if (recent.time > 0 && recent.side !== 0 && recent.side !== side) {
        const squeezeBonus = Math.round(50 * multiplierRef.current)
        scoreRef.current += squeezeBonus
        multiplierRef.current = clamp(multiplierRef.current + 0.3, 1, 5)
        comboTimerRef.current = 3.5
        showMessage(`THREAD THE NEEDLE +${squeezeBonus}`, 1.5)
      } else {
        showMessage(`NEAR MISS +${reward}`)
      }

      nearMissWindowRef.current = {
        time: 0.8,
        side,
      }
    }

    const startLaneChange = (vehicle, direction) => {
      const nextLane = vehicle.lane + direction

      if (nextLane < 0 || nextLane > 2) return
      if (!laneIsClear(vehicle, nextLane, trafficRef.current)) return

      vehicle.targetLane = nextLane
      vehicle.laneState = 'indicating'
      vehicle.indicatorTimer = 0.9
      vehicle.indicatorDirection = direction
    }

    const updateTrafficAI = (vehicle, delta) => {
      if (
        vehicle.kind === 'cone' ||
        vehicle.kind === 'barrier' ||
        vehicle.police
      ) {
        return
      }

      vehicle.aiTimer -= delta

      if (vehicle.laneState === 'indicating') {
        vehicle.indicatorTimer -= delta

        if (vehicle.indicatorTimer <= 0) {
          vehicle.laneState = 'changing'
        }

        return
      }

      if (vehicle.laneState === 'changing') {
        const targetX = LANE_CENTERS[vehicle.targetLane]
        const direction = Math.sign(targetX - vehicle.x)
        const laneChangeSpeed = vehicle.kind === 'truck' ? 32 : 48

        vehicle.x += direction * laneChangeSpeed * delta

        if (Math.abs(targetX - vehicle.x) < 2.5) {
          vehicle.x = targetX
          vehicle.lane = vehicle.targetLane
          vehicle.laneState = 'cruise'
          vehicle.indicatorDirection = 0
          vehicle.aiTimer =
            vehicle.kind === 'truck'
              ? random(5, 9)
              : random(3, 7)
        }

        return
      }

      if (vehicle.aiTimer > 0) return

      const laneChangeChance =
        vehicle.kind === 'truck'
          ? 0.18
          : vehicle.kind === 'fast'
            ? 0.58
            : 0.36

      vehicle.aiTimer =
        vehicle.kind === 'truck'
          ? random(5, 9)
          : random(3, 7)

      if (Math.random() > laneChangeChance) return

      const directions = [-1, 1].filter((direction) => {
        const lane = vehicle.lane + direction
        return lane >= 0 && lane <= 2 && laneIsClear(vehicle, lane, trafficRef.current)
      })

      if (directions.length === 0) return
      startLaneChange(vehicle, randomItem(directions))
    }

    const update = (delta) => {
      if (statusRef.current !== 'playing' || pausedRef.current) return

      const keys = keysRef.current

      if (keys.has('a') || keys.has('arrowleft')) {
        targetXRef.current -= 290 * delta
      }

      if (keys.has('d') || keys.has('arrowright')) {
        targetXRef.current += 290 * delta
      }

      targetXRef.current = clamp(
        targetXRef.current,
        ROAD_LEFT + PLAYER_W / 2 + 4,
        ROAD_RIGHT - PLAYER_W / 2 - 4,
      )

      const env = environmentFor(scoreRef.current)
      const steeringSmoothing =
        env === 'rain'
          ? 1 - Math.pow(0.004, delta)
          : 1 - Math.pow(0.0008, delta)

      playerXRef.current +=
        (targetXRef.current - playerXRef.current) * steeringSmoothing

      if (invulnerableRef.current > 0) {
        invulnerableRef.current = Math.max(0, invulnerableRef.current - delta)
      }

      if (messageTimerRef.current > 0) {
        messageTimerRef.current = Math.max(0, messageTimerRef.current - delta)

        if (messageTimerRef.current === 0) {
          setMessage('')
        }
      }

      if (nearMissWindowRef.current.time > 0) {
        nearMissWindowRef.current.time = Math.max(
          0,
          nearMissWindowRef.current.time - delta,
        )
      }

      if (comboTimerRef.current > 0) {
        comboTimerRef.current = Math.max(0, comboTimerRef.current - delta)
      } else {
        multiplierRef.current = Math.max(
          1,
          multiplierRef.current - 0.12 * delta,
        )
      }

      const cruiseTarget = targetCruiseSpeed(scoreRef.current)
      const boosting =
        boostSourcesRef.current.size > 0 &&
        boostFuelRef.current > 0
      const braking = brakeSourcesRef.current.size > 0

      let targetSpeed = cruiseTarget

      if (braking) {
        targetSpeed = Math.max(MIN_SPEED, cruiseTarget - 55)
      } else if (boosting) {
        targetSpeed = Math.min(MAX_SPEED, cruiseTarget + 35)
      }

      const speedResponse = braking ? 4.8 : boosting ? 3.4 : 2.1

      speedRef.current +=
        (targetSpeed - speedRef.current) *
        Math.min(1, speedResponse * delta)

      if (boosting && !braking) {
        boostFuelRef.current = Math.max(
          0,
          boostFuelRef.current - 18 * delta,
        )

        if (boostFuelRef.current <= 0) {
          boostSourcesRef.current.clear()
          showMessage('BOOST EMPTY', 0.9)
        }
      }

      const playerSpeed = speedRef.current

      roadOffsetRef.current +=
        playerSpeed * ROAD_SCROLL_SCALE * delta

      scoreRef.current +=
        playerSpeed * delta * 0.12 * multiplierRef.current

      trafficTimerRef.current -= delta
      pickupTimerRef.current -= delta
      rearCarTimerRef.current -= delta
      policeTimerRef.current -= delta
      policeDamageCooldownRef.current = Math.max(0, policeDamageCooldownRef.current - delta)

      const policeActive = trafficRef.current.some((vehicle) => vehicle.police)
      if (scoreRef.current >= PURSUIT_START_SCORE && !policeActive) {
        if (pursuitWarningRef.current <= 0 && policeTimerRef.current <= 0) {
          pursuitWarningRef.current = 2
          setPursuitWarning(2)
          showMessage('🚨 POLICE PURSUIT INCOMING 🚨', 2)
        } else if (pursuitWarningRef.current > 0) {
          pursuitWarningRef.current = Math.max(0, pursuitWarningRef.current - delta)
          setPursuitWarning(pursuitWarningRef.current)

          if (pursuitWarningRef.current === 0) {
            const safeLanes = [0, 1, 2].filter((lane) => (
              !trafficRef.current.some((vehicle) => (
                !vehicle.police &&
                vehicle.lane === lane &&
                vehicle.y > PLAYER_Y - 80 &&
                vehicle.y < HEIGHT + 80
              ))
            ))
            const policeLane = randomItem(safeLanes.length ? safeLanes : [0, 1, 2])
            trafficRef.current.push(createPoliceCar(playerSpeed, policeLane))
            policeTimerRef.current = random(24, 36)
            setPoliceHealth(POLICE_MAX_HEALTH)
            showMessage('🚨 POLICE PURSUIT 🚨', 1.5)
          }
        }
      }

      const difficulty = clamp(scoreRef.current / 5000, 0, 1)
      const spawnRate = clamp(1.85 - difficulty * 0.85, 0.82, 1.85)

      if (
        trafficTimerRef.current <= 0 &&
        trafficRef.current.length < 13
      ) {
        const batch = createTrafficBatch(
          scoreRef.current,
          playerSpeed,
        )

        trafficRef.current.push(...batch)
        trafficTimerRef.current =
          spawnRate * random(0.88, 1.2)
      }

      if (
        scoreRef.current >= 1600 &&
        rearCarTimerRef.current <= 0 &&
        trafficRef.current.length < 12
      ) {
        trafficRef.current.push(
          createRearFastCar(scoreRef.current, playerSpeed),
        )
        rearCarTimerRef.current = random(10, 16)
      }

      if (pickupTimerRef.current <= 0) {
        pickupsRef.current.push(createPickup())
        pickupTimerRef.current = random(4.5, 7)
      }

      const player = {
        x: playerXRef.current,
        y: PLAYER_Y,
        w: PLAYER_W * 0.78,
        h: PLAYER_H * 0.86,
      }

      if (escapeRef.current >= 100 && policeActive) {
        trafficRef.current = trafficRef.current.filter((vehicle) => !vehicle.police)
        policeTimerRef.current = random(24, 36)
        escapeRef.current = 0
        setEscape(0)
        showMessage('🚨 POLICE LOST +500 🚨', 1.5)
        scoreRef.current += 500
      }

      const survivingTraffic = []

      for (const current of trafficRef.current) {
        const next = { ...current }

        updateTrafficAI(next, delta)

        if (next.police) {
          const verticalDistance = next.y - PLAYER_Y
          const distanceError = verticalDistance - POLICE_DESIRED_DISTANCE

          next.speed = clamp(
            playerSpeed + distanceError * 0.08,
            MIN_SPEED,
            MAX_SPEED,
          )
          next.reactionTimer -= delta

          if (next.reactionTimer <= 0) {
            next.pursuitOffset = Math.random() < 0.5 ? -55 : 55
            next.reactionTimer = scoreRef.current < 5000 ? 0.7 : scoreRef.current < 8000 ? 0.5 : 0.35
          }

          if (verticalDistance > 90) {
            const targetX = clamp(
              playerXRef.current + next.pursuitOffset,
              ROAD_LEFT + next.w / 2 + 4,
              ROAD_RIGHT - next.w / 2 - 4,
            )
            const chaseStep = 34 * delta
            next.x += clamp(targetX - next.x, -chaseStep, chaseStep)
          }

          escapeRef.current = clamp(
            escapeRef.current + (verticalDistance > 190 ? 10 : verticalDistance < 95 ? -18 : -2) * delta,
            0,
            100,
          )
        }

        const relativeSpeed = playerSpeed - next.speed

        next.y +=
          relativeSpeed *
          TRAFFIC_SCROLL_SCALE *
          delta

        next.braking =
          !next.police &&
          next.kind !== 'cone' &&
          next.kind !== 'barrier' &&
          relativeSpeed > 42

        const obstacleRect = {
          x: next.x,
          y: next.y,
          w: next.w * 0.78,
          h: next.h * 0.86,
        }

        if (
          next.police &&
          policeDamageCooldownRef.current <= 0 &&
          trafficRef.current.some((other) => {
            if (other.id === next.id || other.police) return false
            return rectsOverlap(obstacleRect, {
              x: other.x,
              y: other.y,
              w: other.w * 0.78,
              h: other.h * 0.86,
            })
          })
        ) {
          next.policeHealth -= 1
          policeDamageCooldownRef.current = 0.8
          setPoliceHealth(next.policeHealth)
          showMessage(`POLICE DAMAGE ${next.policeHealth}/${POLICE_MAX_HEALTH}`, 0.9)

          if (next.policeHealth <= 0) {
            scoreRef.current += 250
            showMessage('💥 POLICE DISABLED +250', 1.4)
            continue
          }
        }

        const collision =
          rectsOverlap(player, obstacleRect) &&
          invulnerableRef.current <= 0

        if (collision) {
          if (next.police) {
            if (policeDamageCooldownRef.current <= 0) {
              policeDamageCooldownRef.current = 1.2
              targetXRef.current = clamp(
                targetXRef.current + (next.x <= playerXRef.current ? 34 : -34),
                ROAD_LEFT + PLAYER_W / 2 + 4,
                ROAD_RIGHT - PLAYER_W / 2 - 4,
              )
              speedRef.current = Math.max(MIN_SPEED, speedRef.current - 35)
              multiplierRef.current = 1
              escapeRef.current = Math.max(0, escapeRef.current - 28)
              showMessage('POLICE CONTACT - SPEED REDUCED', 1.1)
            }
            next.y = PLAYER_Y + POLICE_DESIRED_DISTANCE
            continue
          }

          const damage = next.kind === 'barrier' ? 2 : 1

          healthRef.current = Math.max(
            0,
            healthRef.current - damage,
          )

          invulnerableRef.current = 1.2
          multiplierRef.current = 1
          comboTimerRef.current = 0

          speedRef.current = Math.max(
            MIN_SPEED,
            speedRef.current - 32,
          )

          const knockDirection =
            next.x <= playerXRef.current ? 1 : -1

          targetXRef.current = clamp(
            targetXRef.current + knockDirection * 42,
            ROAD_LEFT + PLAYER_W / 2 + 4,
            ROAD_RIGHT - PLAYER_W / 2 - 4,
          )

          setHealth(healthRef.current)
          showMessage(
            damage > 1 ? 'HARD CRASH -2 ❤️' : 'CRASH -1 ❤️',
            1.2,
          )

          if (healthRef.current <= 0) {
            endGame('Your car is wrecked')
            break
          }

          continue
        }

        const passedPlayer =
          !next.rearSpawn &&
          next.speed < playerSpeed &&
          current.y <= PLAYER_Y + current.h / 2 &&
          next.y > PLAYER_Y + next.h / 2

        if (passedPlayer && next.kind !== 'cone' && next.kind !== 'barrier') {
          const sideGap =
            Math.abs(next.x - player.x) -
            (next.w + player.w) / 2

          const nearMiss =
            sideGap > 0 &&
            sideGap < 18

          rewardOvertake(next, nearMiss)
        }

        if (
          next.y > -180 &&
          next.y < HEIGHT + 180
        ) {
          survivingTraffic.push(next)
        }
      }

      trafficRef.current = resolveTrafficSpacing(survivingTraffic, playerSpeed)

      const survivingPickups = []

      for (const pickup of pickupsRef.current) {
        const next = {
          ...pickup,
          y:
            pickup.y +
            playerSpeed *
              ROAD_SCROLL_SCALE *
              delta,
        }

        const dx = next.x - player.x
        const dy = next.y - player.y

        if (
          Math.hypot(dx, dy) <
          next.r + PLAYER_W * 0.36
        ) {
          if (next.kind === 'coin') {
            const reward = Math.round(
              60 * multiplierRef.current,
            )

            scoreRef.current += reward
            showMessage(`COIN +${reward}`, 0.9)
          }

          if (next.kind === 'fuel') {
            boostFuelRef.current = Math.min(
              100,
              boostFuelRef.current + 38,
            )
            showMessage('BOOST +38%', 0.9)
          }

          if (next.kind === 'repair') {
            const before = healthRef.current
            healthRef.current = Math.min(
              MAX_HEALTH,
              healthRef.current + 1,
            )

            setHealth(healthRef.current)

            showMessage(
              healthRef.current > before
                ? 'REPAIRED +1 ❤️'
                : 'HEALTH FULL',
              0.9,
            )
          }

          continue
        }

        if (next.y < HEIGHT + 60) {
          survivingPickups.push(next)
        }
      }

      pickupsRef.current = survivingPickups

      hudTimerRef.current -= delta

      if (hudTimerRef.current <= 0) {
        setScore(Math.floor(scoreRef.current))
        setBoostFuel(Math.round(boostFuelRef.current))
        setSpeed(Math.round(speedRef.current))
        setMultiplier(
          Number(multiplierRef.current.toFixed(1)),
        )
        setEscape(Math.round(escapeRef.current))
        hudTimerRef.current = 0.1
      }

      const nextEnvironment = environmentFor(scoreRef.current)

      setEnvironment((current) =>
        current === nextEnvironment
          ? current
          : nextEnvironment,
      )
    }

    const loop = (time) => {
      if (lastTimeRef.current == null) {
        lastTimeRef.current = time
      }

      const delta = Math.min(
        (time - lastTimeRef.current) / 1000,
        0.05,
      )

      lastTimeRef.current = time

      update(delta)
      render()

      frameRef.current = requestAnimationFrame(loop)
    }

    frameRef.current = requestAnimationFrame(loop)

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current)
      }
    }
  }, [endGame, showMessage])

  return (
    <section className="screen driving-screen">
      <div className="driving-shell">
        <div className="driving-header">
          <button
            className="secondary-button"
            type="button"
            onClick={onBack}
          >
            ← Back
          </button>

          <h2>Highway Escape</h2>

          <div className="score-pill driving-best">
            Best: {best}
          </div>
        </div>

        <div className="driving-hud">
          <span>
            Score <strong>{score}</strong>
          </span>

          <span>
            Speed <strong>{speed} km/h</strong>
          </span>

          <span>
            Combo <strong>×{multiplier.toFixed(1)}</strong>
          </span>

          <span>
            ❤️ {health}/{MAX_HEALTH}
          </span>

          <span>
            ⚡ {boostFuel}%
          </span>

          {environment === 'pursuit' && (
            <span>
              🚓 {policeHealth}/{POLICE_MAX_HEALTH}
            </span>
          )}

          {environment === 'pursuit' && (
            <span className="driving-escape">
              Escape {escape}%
            </span>
          )}

          {pursuitWarning > 0 && (
            <span className="driving-pursuit-warning">
              🚨 Pursuit in {Math.ceil(pursuitWarning)}s
            </span>
          )}

          <span className="driving-env">
            {environment.toUpperCase()}
          </span>
        </div>

        <canvas
          ref={canvasRef}
          className="driving-canvas"
          width={WIDTH}
          height={HEIGHT}
          aria-label={`Highway Escape. Score ${score}. Speed ${speed} kilometers per hour. Health ${health}. Boost ${boostFuel} percent.`}
        />

        <div className="driving-actions">
          {status === 'gameover' ? (
            <button
              className="primary-button"
              type="button"
              onClick={startGame}
            >
              Play again
            </button>
          ) : status === 'ready' ? (
            <button
              className="primary-button"
              type="button"
              onClick={startGame}
            >
              Start
            </button>
          ) : (
            <>
              <button
                className="primary-button"
                type="button"
                onPointerDown={(event) => {
                  event.preventDefault()
                  startBoost('button')
                }}
                onPointerUp={() => stopBoost('button')}
                onPointerCancel={() => stopBoost('button')}
                onPointerLeave={() => stopBoost('button')}
              >
                Hold Boost
              </button>

              <button
                className="secondary-button"
                type="button"
                onPointerDown={(event) => {
                  event.preventDefault()
                  startBrake('button')
                }}
                onPointerUp={() => stopBrake('button')}
                onPointerCancel={() => stopBrake('button')}
                onPointerLeave={() => stopBrake('button')}
              >
                Hold Brake
              </button>

              <button
                className="secondary-button"
                type="button"
                onClick={resetGame}
              >
                Restart
              </button>
            </>
          )}
        </div>

        {message && (
          <div className="driving-message">
            {message}
          </div>
        )}

        <p className="driving-help">
          🖱️ Move mouse / drag to steer · Hold left mouse or Space/Shift to boost · Hold right mouse or S to brake · A/D also steer
        </p>
      </div>
    </section>
  )
}
