import { useCallback, useEffect, useRef, useState } from 'react'
import './HelicopterGame.css'

const WIDTH = 760
const HEIGHT = 560
const PLAYER_RADIUS = 21
const MAX_HEALTH = 100
const MAX_ROCKETS = 8

const MISSIONS = [
  { title: 'Convoy Breaker', description: 'Destroy 5 enemy vehicles.', target: 5, kind: 'vehicles' },
  { title: 'Blind the Enemy', description: 'Destroy the radar station.', target: 1, kind: 'radar' },
  { title: 'Escort Run', description: 'Protect the friendly convoy for 20 seconds.', target: 20, kind: 'escort' },
  { title: 'Air Superiority', description: 'Destroy 4 enemy helicopters.', target: 4, kind: 'helicopters' },
  { title: 'Final Strike', description: 'Destroy the enemy command base.', target: 1, kind: 'base' },
]

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
const random = (min, max) => min + Math.random() * (max - min)

function loadBest() {
  try {
    return Number(localStorage.getItem('y9-helicopter-best') || 0)
  } catch {
    return 0
  }
}

function enemyTemplate(type) {
  if (type === 'truck') return { hp: 65, radius: 17, speed: 36, fireDelay: 1.7, damage: 7, score: 80, color: '#7f8c46' }
  if (type === 'tank') return { hp: 145, radius: 22, speed: 22, fireDelay: 1.3, damage: 11, score: 140, color: '#5f6f3d' }
  if (type === 'aa') return { hp: 110, radius: 20, speed: 12, fireDelay: 0.85, damage: 9, score: 170, color: '#6c5b3c' }
  if (type === 'helicopter') return { hp: 115, radius: 22, speed: 64, fireDelay: 0.78, damage: 8, score: 210, color: '#8a4f4f' }
  if (type === 'radar') return { hp: 520, radius: 34, speed: 5, fireDelay: 1.05, damage: 11, score: 550, color: '#5c677d' }
  if (type === 'base') return { hp: 1100, radius: 52, speed: 3, fireDelay: 0.62, damage: 13, score: 1200, color: '#495057' }
  return { hp: 55, radius: 13, speed: 32, fireDelay: 2.1, damage: 5, score: 50, color: '#6b7f38' }
}

function createEnemy(type, fixedX = null, fixedY = null) {
  const t = enemyTemplate(type)
  return {
    id: Math.random().toString(36).slice(2),
    type,
    x: fixedX ?? random(70, WIDTH - 70),
    y: fixedY ?? random(-150, -50),
    hp: t.hp,
    maxHp: t.hp,
    radius: t.radius,
    speed: t.speed,
    fireDelay: t.fireDelay,
    fireTimer: random(0.3, t.fireDelay),
    damage: t.damage,
    score: t.score,
    color: t.color,
    strafe: Math.random() < 0.5 ? -1 : 1,
    phase: random(0, Math.PI * 2),
    hitFlash: 0,
  }
}

function drawHelicopter(ctx, x, y, angle, color, scale = 1) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(angle)
  ctx.scale(scale, scale)

  ctx.strokeStyle = 'rgba(0, 0, 0, 0.38)'
  ctx.lineWidth = 5
  ctx.beginPath()
  ctx.moveTo(-29, 0)
  ctx.lineTo(31, 0)
  ctx.stroke()

  ctx.fillStyle = color
  ctx.beginPath()
  ctx.ellipse(0, 0, 22, 13, 0, 0, Math.PI * 2)
  ctx.fill()

  ctx.fillStyle = '#9bd4e6'
  ctx.beginPath()
  ctx.ellipse(11, -1, 8, 7, 0, 0, Math.PI * 2)
  ctx.fill()

  ctx.strokeStyle = '#d8dee9'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(-31, -5)
  ctx.lineTo(-31, 5)
  ctx.stroke()

  ctx.strokeStyle = 'rgba(230, 240, 245, 0.72)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(-29, -29)
  ctx.lineTo(29, 29)
  ctx.moveTo(-29, 29)
  ctx.lineTo(29, -29)
  ctx.stroke()

  ctx.restore()
}

export default function HelicopterGame({ onBack }) {
  const canvasRef = useRef(null)
  const frameRef = useRef(null)
  const keysRef = useRef(new Set())
  const statusRef = useRef('ready')
  const pausedRef = useRef(false)
  const pointerDownRef = useRef(false)
  const playerRef = useRef({ x: WIDTH / 2, y: HEIGHT * 0.72, health: MAX_HEALTH, invulnerable: 0 })
  const aimRef = useRef({ x: WIDTH / 2, y: HEIGHT * 0.25, angle: -Math.PI / 2 })
  const moveStickRef = useRef({ x: 0, y: 0 })
  const aimStickRef = useRef({ x: 0, y: -1 })
  const bulletsRef = useRef([])
  const rocketsRef = useRef([])
  const enemyBulletsRef = useRef([])
  const enemiesRef = useRef([])
  const effectsRef = useRef([])
  const terrainOffsetRef = useRef(0)
  const fireTimerRef = useRef(0)
  const rocketTimerRef = useRef(0)
  const spawnTimerRef = useRef(0)
  const rocketsLeftRef = useRef(MAX_ROCKETS)
  const scoreRef = useRef(0)
  const missionIndexRef = useRef(0)
  const missionProgressRef = useRef(0)
  const missionCompleteRef = useRef(false)
  const escortHealthRef = useRef(100)
  const lastTimeRef = useRef(null)
  const bestRef = useRef(loadBest())

  const [status, setStatus] = useState('ready')
  const [score, setScore] = useState(0)
  const [health, setHealth] = useState(MAX_HEALTH)
  const [rocketsLeft, setRocketsLeft] = useState(MAX_ROCKETS)
  const [best, setBest] = useState(bestRef.current)
  const [missionIndex, setMissionIndex] = useState(0)
  const [missionProgress, setMissionProgress] = useState(0)
  const [escortHealth, setEscortHealth] = useState(100)
  const [notice, setNotice] = useState('WASD move · mouse aim · left click fire')

  const saveBest = useCallback((value) => {
    if (value <= bestRef.current) return
    bestRef.current = value
    setBest(value)
    try {
      localStorage.setItem('y9-helicopter-best', String(value))
    } catch {
      // Ignore storage failures.
    }
  }, [])

  const setupMission = useCallback((index) => {
    missionIndexRef.current = index
    missionProgressRef.current = 0
    missionCompleteRef.current = false
    spawnTimerRef.current = 0.25
    rocketsLeftRef.current = MAX_ROCKETS
    escortHealthRef.current = 100
    setMissionIndex(index)
    setMissionProgress(0)
    setRocketsLeft(MAX_ROCKETS)
    setEscortHealth(100)

    const mission = MISSIONS[index]
    if (!mission) return
    setNotice(`Mission ${index + 1}: ${mission.title}`)
    window.setTimeout(() => setNotice(''), 1500)

    if (mission.kind === 'radar') enemiesRef.current.push(createEnemy('radar', WIDTH / 2, -90))
    if (mission.kind === 'base') enemiesRef.current.push(createEnemy('base', WIDTH / 2, -120))
  }, [])

  const resetGame = useCallback(() => {
    statusRef.current = 'ready'
    playerRef.current = { x: WIDTH / 2, y: HEIGHT * 0.72, health: MAX_HEALTH, invulnerable: 0 }
    aimRef.current = { x: WIDTH / 2, y: HEIGHT * 0.25, angle: -Math.PI / 2 }
    moveStickRef.current = { x: 0, y: 0 }
    aimStickRef.current = { x: 0, y: -1 }
    bulletsRef.current = []
    rocketsRef.current = []
    enemyBulletsRef.current = []
    enemiesRef.current = []
    effectsRef.current = []
    terrainOffsetRef.current = 0
    fireTimerRef.current = 0
    rocketTimerRef.current = 0
    scoreRef.current = 0
    missionIndexRef.current = 0
    missionProgressRef.current = 0
    missionCompleteRef.current = false
    escortHealthRef.current = 100
    rocketsLeftRef.current = MAX_ROCKETS
    lastTimeRef.current = null

    setStatus('ready')
    setScore(0)
    setHealth(MAX_HEALTH)
    setRocketsLeft(MAX_ROCKETS)
    setMissionIndex(0)
    setMissionProgress(0)
    setEscortHealth(100)
    setNotice('WASD move · mouse aim · left click fire')
  }, [])

  const startGame = useCallback(() => {
    resetGame()
    statusRef.current = 'playing'
    setStatus('playing')
    setupMission(0)
  }, [resetGame, setupMission])

  const finishRun = useCallback((message) => {
    statusRef.current = 'gameover'
    setStatus('gameover')
    setNotice(message)
    saveBest(scoreRef.current)
  }, [saveBest])

  const completeMission = useCallback(() => {
    if (missionCompleteRef.current) return
    missionCompleteRef.current = true
    const current = missionIndexRef.current
    const finalMission = current >= MISSIONS.length - 1
    scoreRef.current += 500
    setScore(scoreRef.current)

    if (finalMission) {
      saveBest(scoreRef.current)
      statusRef.current = 'victory'
      setStatus('victory')
      setNotice('Campaign complete — enemy command destroyed')
      return
    }

    setNotice(`Mission ${current + 1} complete`)
    window.setTimeout(() => {
      if (statusRef.current !== 'playing') return
      enemiesRef.current = []
      enemyBulletsRef.current = []
      setupMission(current + 1)
    }, 1200)
  }, [saveBest, setupMission])

  const fireGun = useCallback(() => {
    if (statusRef.current === 'ready') {
      statusRef.current = 'playing'
      setStatus('playing')
      setupMission(0)
    }
    if (statusRef.current !== 'playing' || fireTimerRef.current > 0) return
    fireTimerRef.current = 0.075
    const player = playerRef.current
    const angle = aimRef.current.angle + random(-0.028, 0.028)
    bulletsRef.current.push({
      id: Math.random().toString(36).slice(2),
      x: player.x + Math.cos(angle) * 26,
      y: player.y + Math.sin(angle) * 26,
      vx: Math.cos(angle) * 820,
      vy: Math.sin(angle) * 820,
      damage: 23,
      life: 1.15,
    })
  }, [setupMission])

  const fireRocket = useCallback(() => {
    if (statusRef.current !== 'playing' || rocketTimerRef.current > 0 || rocketsLeftRef.current <= 0) return
    rocketTimerRef.current = 0.7
    rocketsLeftRef.current -= 1
    setRocketsLeft(rocketsLeftRef.current)
    const player = playerRef.current
    const angle = aimRef.current.angle
    rocketsRef.current.push({
      id: Math.random().toString(36).slice(2),
      x: player.x + Math.cos(angle) * 24,
      y: player.y + Math.sin(angle) * 24,
      vx: Math.cos(angle) * 430,
      vy: Math.sin(angle) * 430,
      damage: 185,
      life: 2.2,
      angle,
    })
  }, [])

  useEffect(() => {
    const handleKeyDown = (event) => {
      keysRef.current.add(event.key.toLowerCase())
      if (event.code === 'Space' && (statusRef.current === 'gameover' || statusRef.current === 'victory')) {
        event.preventDefault()
        startGame()
      }
      if (event.key.toLowerCase() === 'q') fireRocket()
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
  }, [fireRocket, startGame])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined

    const pointerToCanvas = (event) => {
      const rect = canvas.getBoundingClientRect()
      return {
        x: ((event.clientX - rect.left) / rect.width) * WIDTH,
        y: ((event.clientY - rect.top) / rect.height) * HEIGHT,
      }
    }
    const onMove = (event) => {
      const point = pointerToCanvas(event)
      const p = playerRef.current
      aimRef.current = { x: point.x, y: point.y, angle: Math.atan2(point.y - p.y, point.x - p.x) }
    }
    const onDown = (event) => {
      onMove(event)
      if (event.button === 0) {
        pointerDownRef.current = true
        fireGun()
      }
      if (event.button === 2) {
        event.preventDefault()
        fireRocket()
      }
    }
    const onUp = (event) => {
      if (event.button === 0) pointerDownRef.current = false
    }
    const onContext = (event) => event.preventDefault()

    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerdown', onDown)
    window.addEventListener('pointerup', onUp)
    canvas.addEventListener('contextmenu', onContext)
    return () => {
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('contextmenu', onContext)
    }
  }, [fireGun, fireRocket])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const ctx = canvas.getContext('2d')

    const drawTerrain = () => {
      ctx.fillStyle = '#506b39'
      ctx.fillRect(0, 0, WIDTH, HEIGHT)

      const offset = terrainOffsetRef.current % 180
      ctx.fillStyle = '#657b45'
      ctx.fillRect(WIDTH * 0.43, 0, WIDTH * 0.14, HEIGHT)
      ctx.fillStyle = '#4c5f35'
      ctx.fillRect(WIDTH * 0.465, 0, WIDTH * 0.07, HEIGHT)

      ctx.strokeStyle = 'rgba(236, 220, 170, 0.45)'
      ctx.lineWidth = 3
      for (let y = -180 + offset; y < HEIGHT + 180; y += 180) {
        ctx.beginPath()
        ctx.moveTo(WIDTH * 0.498, y)
        ctx.lineTo(WIDTH * 0.498, y + 70)
        ctx.stroke()
      }

      for (let i = 0; i < 30; i += 1) {
        const side = i % 2 === 0 ? 1 : -1
        const x = side > 0 ? WIDTH * 0.67 + (i * 41) % 180 : WIDTH * 0.1 + (i * 47) % 150
        const y = (i * 103 + terrainOffsetRef.current * 0.7) % (HEIGHT + 80) - 40
        ctx.fillStyle = '#2f5d2c'
        ctx.beginPath()
        ctx.arc(x, y, 10 + (i % 4) * 2, 0, Math.PI * 2)
        ctx.fill()
      }

      ctx.fillStyle = 'rgba(170, 190, 120, 0.3)'
      for (let i = 0; i < 12; i += 1) {
        const x = (i * 149 + 30) % WIDTH
        const y = (i * 211 + terrainOffsetRef.current * 0.35) % HEIGHT
        ctx.fillRect(x, y, 24, 13)
      }
    }

    const drawGroundEnemy = (enemy) => {
      ctx.save()
      ctx.translate(enemy.x, enemy.y)
      ctx.fillStyle = enemy.hitFlash > 0 ? '#ffffff' : enemy.color

      if (enemy.type === 'radar') {
        ctx.fillRect(-24, -19, 48, 38)
        ctx.strokeStyle = '#d0d7de'
        ctx.lineWidth = 4
        ctx.beginPath()
        ctx.arc(0, -15, 24, Math.PI * 0.1, Math.PI * 0.9)
        ctx.stroke()
      } else if (enemy.type === 'base') {
        ctx.fillRect(-45, -38, 90, 76)
        ctx.fillStyle = '#343a40'
        ctx.fillRect(-14, -55, 28, 25)
        ctx.fillStyle = '#fa5252'
        ctx.fillRect(-6, -62, 12, 8)
      } else {
        ctx.fillRect(-enemy.radius, -enemy.radius * 0.65, enemy.radius * 2, enemy.radius * 1.3)
        ctx.fillStyle = '#30352a'
        ctx.fillRect(-enemy.radius * 0.4, -enemy.radius, enemy.radius * 0.8, enemy.radius * 0.55)
        if (enemy.type === 'aa' || enemy.type === 'tank') {
          ctx.strokeStyle = '#2d3028'
          ctx.lineWidth = 4
          ctx.beginPath()
          ctx.moveTo(0, -enemy.radius * 0.8)
          ctx.lineTo(0, -enemy.radius * 1.55)
          ctx.stroke()
        }
      }

      if (enemy.hp < enemy.maxHp) {
        const w = enemy.radius * 2.2
        ctx.fillStyle = 'rgba(0,0,0,.45)'
        ctx.fillRect(-w / 2, -enemy.radius - 18, w, 5)
        ctx.fillStyle = '#69db7c'
        ctx.fillRect(-w / 2, -enemy.radius - 18, w * clamp(enemy.hp / enemy.maxHp, 0, 1), 5)
      }
      ctx.restore()
    }

    const drawConvoy = () => {
      if (MISSIONS[missionIndexRef.current]?.kind !== 'escort') return
      const y = HEIGHT - 78
      ctx.fillStyle = '#4dabf7'
      for (let i = 0; i < 3; i += 1) {
        const x = WIDTH / 2 - 52 + i * 52
        ctx.fillRect(x - 16, y - i * 14, 32, 22)
        ctx.fillStyle = '#d0ebff'
        ctx.fillRect(x - 8, y - 18 - i * 14, 16, 8)
        ctx.fillStyle = '#4dabf7'
      }
    }

    const drawProjectiles = () => {
      for (const bullet of bulletsRef.current) {
        ctx.fillStyle = '#fff3bf'
        ctx.beginPath()
        ctx.arc(bullet.x, bullet.y, 2.5, 0, Math.PI * 2)
        ctx.fill()
      }
      for (const rocket of rocketsRef.current) {
        ctx.save()
        ctx.translate(rocket.x, rocket.y)
        ctx.rotate(rocket.angle)
        ctx.fillStyle = '#f8f9fa'
        ctx.fillRect(-8, -3, 16, 6)
        ctx.fillStyle = '#ff922b'
        ctx.fillRect(-12, -2, 5, 4)
        ctx.restore()
      }
      for (const bullet of enemyBulletsRef.current) {
        ctx.fillStyle = '#ff6b6b'
        ctx.beginPath()
        ctx.arc(bullet.x, bullet.y, 4, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    const drawEffects = () => {
      for (const effect of effectsRef.current) {
        const ratio = effect.life / effect.maxLife
        ctx.globalAlpha = clamp(ratio, 0, 1)
        ctx.fillStyle = effect.color
        ctx.beginPath()
        ctx.arc(effect.x, effect.y, effect.radius * (1 - ratio * 0.45), 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }

    const render = () => {
      drawTerrain()
      drawConvoy()
      for (const enemy of enemiesRef.current) {
        if (enemy.type === 'helicopter') {
          const p = playerRef.current
          const angle = Math.atan2(p.y - enemy.y, p.x - enemy.x)
          drawHelicopter(ctx, enemy.x, enemy.y, angle, enemy.hitFlash > 0 ? '#ffffff' : enemy.color, 0.9)
          if (enemy.hp < enemy.maxHp) {
            const w = 44
            ctx.fillStyle = 'rgba(0,0,0,.45)'
            ctx.fillRect(enemy.x - w / 2, enemy.y - 37, w, 5)
            ctx.fillStyle = '#69db7c'
            ctx.fillRect(enemy.x - w / 2, enemy.y - 37, w * clamp(enemy.hp / enemy.maxHp, 0, 1), 5)
          }
        } else {
          drawGroundEnemy(enemy)
        }
      }
      drawProjectiles()
      drawEffects()

      const player = playerRef.current
      const blink = player.invulnerable > 0 && Math.floor(player.invulnerable * 14) % 2 === 0
      if (!blink) drawHelicopter(ctx, player.x, player.y, aimRef.current.angle, '#2f6f8f', 1)

      if (statusRef.current !== 'playing') {
        ctx.fillStyle = 'rgba(10, 14, 10, 0.58)'
        ctx.fillRect(0, 0, WIDTH, HEIGHT)
        ctx.fillStyle = '#fff'
        ctx.textAlign = 'center'
        ctx.font = '900 36px system-ui'
        const title = statusRef.current === 'victory' ? 'MISSION ACCOMPLISHED' : statusRef.current === 'gameover' ? 'HELICOPTER DOWN' : 'HELICOPTER ASSAULT'
        ctx.fillText(title, WIDTH / 2, HEIGHT / 2 - 12)
        ctx.font = '700 16px system-ui'
        ctx.fillText(statusRef.current === 'ready' ? 'Start the campaign' : `Score ${scoreRef.current}`, WIDTH / 2, HEIGHT / 2 + 24)
      }
    }

    const hitEnemy = (enemy, damage, explosion = false) => {
      enemy.hp -= damage
      enemy.hitFlash = 0.08
      if (explosion) effectsRef.current.push({ x: enemy.x, y: enemy.y, radius: 34, life: 0.28, maxLife: 0.28, color: '#ff922b' })
    }

    const registerKill = (enemy) => {
      scoreRef.current += enemy.score
      setScore(scoreRef.current)
      const mission = MISSIONS[missionIndexRef.current]
      if (!mission) return

      let counts = false
      if (mission.kind === 'vehicles' && ['truck', 'tank', 'aa'].includes(enemy.type)) counts = true
      if (mission.kind === 'radar' && enemy.type === 'radar') counts = true
      if (mission.kind === 'helicopters' && enemy.type === 'helicopter') counts = true
      if (mission.kind === 'base' && enemy.type === 'base') counts = true

      if (counts) {
        missionProgressRef.current += 1
        setMissionProgress(missionProgressRef.current)
        if (missionProgressRef.current >= mission.target) completeMission()
      }
    }

    const update = (delta) => {
      if (statusRef.current !== 'playing' || pausedRef.current) return

      if (pointerDownRef.current) fireGun()
      fireTimerRef.current = Math.max(0, fireTimerRef.current - delta)
      rocketTimerRef.current = Math.max(0, rocketTimerRef.current - delta)

      const player = playerRef.current
      const keys = keysRef.current
      let moveX = moveStickRef.current.x
      let moveY = moveStickRef.current.y
      if (keys.has('a') || keys.has('arrowleft')) moveX -= 1
      if (keys.has('d') || keys.has('arrowright')) moveX += 1
      if (keys.has('w') || keys.has('arrowup')) moveY -= 1
      if (keys.has('s') || keys.has('arrowdown')) moveY += 1
      const length = Math.hypot(moveX, moveY) || 1
      const boosting = keys.has('shift')
      const moveSpeed = boosting ? 300 : 205
      if (Math.abs(moveX) > 0.01 || Math.abs(moveY) > 0.01) {
        player.x = clamp(player.x + (moveX / length) * moveSpeed * delta, 34, WIDTH - 34)
        player.y = clamp(player.y + (moveY / length) * moveSpeed * delta, 40, HEIGHT - 35)
      }
      player.invulnerable = Math.max(0, player.invulnerable - delta)
      terrainOffsetRef.current += (boosting ? 175 : 110) * delta

      if (Math.hypot(aimStickRef.current.x, aimStickRef.current.y) > 0.2) {
        aimRef.current.angle = Math.atan2(aimStickRef.current.y, aimStickRef.current.x)
      } else {
        aimRef.current.angle = Math.atan2(aimRef.current.y - player.y, aimRef.current.x - player.x)
      }

      const mission = MISSIONS[missionIndexRef.current]
      spawnTimerRef.current -= delta
      if (!missionCompleteRef.current && spawnTimerRef.current <= 0) {
        let type = 'truck'
        if (mission.kind === 'vehicles') {
          const roll = Math.random()
          type = roll < 0.45 ? 'truck' : roll < 0.78 ? 'tank' : 'aa'
        } else if (mission.kind === 'radar') {
          type = Math.random() < 0.55 ? 'aa' : 'tank'
        } else if (mission.kind === 'escort') {
          type = Math.random() < 0.46 ? 'truck' : Math.random() < 0.78 ? 'aa' : 'helicopter'
        } else if (mission.kind === 'helicopters') {
          type = Math.random() < 0.68 ? 'helicopter' : 'aa'
        } else if (mission.kind === 'base') {
          type = Math.random() < 0.52 ? 'aa' : Math.random() < 0.76 ? 'tank' : 'helicopter'
        }
        enemiesRef.current.push(createEnemy(type))
        spawnTimerRef.current = mission.kind === 'escort' ? random(0.75, 1.25) : random(0.9, 1.55)
      }

      if (mission.kind === 'escort' && !missionCompleteRef.current) {
        missionProgressRef.current += delta
        setMissionProgress(Math.min(mission.target, missionProgressRef.current))
        if (missionProgressRef.current >= mission.target) completeMission()
      }

      bulletsRef.current = bulletsRef.current
        .map((bullet) => ({ ...bullet, x: bullet.x + bullet.vx * delta, y: bullet.y + bullet.vy * delta, life: bullet.life - delta }))
        .filter((bullet) => bullet.life > 0 && bullet.x > -20 && bullet.x < WIDTH + 20 && bullet.y > -20 && bullet.y < HEIGHT + 20)
      rocketsRef.current = rocketsRef.current
        .map((rocket) => ({ ...rocket, x: rocket.x + rocket.vx * delta, y: rocket.y + rocket.vy * delta, life: rocket.life - delta }))
        .filter((rocket) => rocket.life > 0 && rocket.x > -30 && rocket.x < WIDTH + 30 && rocket.y > -30 && rocket.y < HEIGHT + 30)
      enemyBulletsRef.current = enemyBulletsRef.current
        .map((bullet) => ({ ...bullet, x: bullet.x + bullet.vx * delta, y: bullet.y + bullet.vy * delta, life: bullet.life - delta }))
        .filter((bullet) => bullet.life > 0)

      const survivors = []
      for (const enemy of enemiesRef.current) {
        const next = { ...enemy, hitFlash: Math.max(0, enemy.hitFlash - delta), fireTimer: enemy.fireTimer - delta }
        next.phase += delta

        if (enemy.type === 'helicopter') {
          next.y += enemy.speed * 0.25 * delta
          next.x += Math.sin(next.phase * 2.1) * enemy.speed * 0.35 * delta * enemy.strafe
        } else {
          next.y += (enemy.speed + 24) * delta
        }

        const dx = player.x - next.x
        const dy = player.y - next.y
        const distance = Math.hypot(dx, dy) || 1
        if (next.fireTimer <= 0 && distance < 520) {
          const bulletSpeed = enemy.type === 'aa' || enemy.type === 'base' ? 275 : 220
          enemyBulletsRef.current.push({
            id: Math.random().toString(36).slice(2),
            x: next.x,
            y: next.y,
            vx: (dx / distance) * bulletSpeed,
            vy: (dy / distance) * bulletSpeed,
            damage: enemy.damage,
            life: 3,
          })
          next.fireTimer = enemy.fireDelay * random(0.8, 1.25)
        }

        for (const bullet of bulletsRef.current) {
          if (bullet.dead) continue
          if (Math.hypot(bullet.x - next.x, bullet.y - next.y) < next.radius + 4) {
            hitEnemy(next, bullet.damage)
            bullet.dead = true
          }
        }

        for (const rocket of rocketsRef.current) {
          if (rocket.dead) continue
          if (Math.hypot(rocket.x - next.x, rocket.y - next.y) < next.radius + 8) {
            hitEnemy(next, rocket.damage, true)
            rocket.dead = true
            for (const other of enemiesRef.current) {
              if (other.id !== next.id && Math.hypot(other.x - rocket.x, other.y - rocket.y) < 68) other.hp -= 75
            }
          }
        }

        if (next.hp <= 0) {
          effectsRef.current.push({ x: next.x, y: next.y, radius: next.radius * 1.8, life: 0.42, maxLife: 0.42, color: '#ff922b' })
          registerKill(next)
          continue
        }

        if (mission.kind === 'escort' && next.y > HEIGHT - 112 && ['truck', 'tank', 'aa'].includes(next.type)) {
          escortHealthRef.current = Math.max(0, escortHealthRef.current - next.damage * 1.4)
          setEscortHealth(Math.round(escortHealthRef.current))
          effectsRef.current.push({ x: WIDTH / 2, y: HEIGHT - 78, radius: 30, life: 0.35, maxLife: 0.35, color: '#ff6b6b' })
          if (escortHealthRef.current <= 0) finishRun('Friendly convoy destroyed')
          continue
        }

        if (next.y < HEIGHT + 120 && next.x > -100 && next.x < WIDTH + 100) survivors.push(next)
      }
      enemiesRef.current = survivors
      bulletsRef.current = bulletsRef.current.filter((bullet) => !bullet.dead)
      rocketsRef.current = rocketsRef.current.filter((rocket) => !rocket.dead)

      const nextEnemyBullets = []
      for (const bullet of enemyBulletsRef.current) {
        if (Math.hypot(bullet.x - player.x, bullet.y - player.y) < PLAYER_RADIUS + 5 && player.invulnerable <= 0) {
          player.health -= bullet.damage
          player.invulnerable = 0.32
          setHealth(Math.max(0, Math.round(player.health)))
          continue
        }
        nextEnemyBullets.push(bullet)
      }
      enemyBulletsRef.current = nextEnemyBullets

      effectsRef.current = effectsRef.current
        .map((effect) => ({ ...effect, life: effect.life - delta }))
        .filter((effect) => effect.life > 0)

      if (player.health <= 0) finishRun('Helicopter destroyed')
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
  }, [completeMission, fireGun, finishRun])

  const bindStick = (ref, mode) => ({
    onPointerDown: (event) => {
      event.currentTarget.setPointerCapture(event.pointerId)
      const element = event.currentTarget
      const rect = element.getBoundingClientRect()
      const update = (clientX, clientY) => {
        let x = ((clientX - rect.left) / rect.width) * 2 - 1
        let y = ((clientY - rect.top) / rect.height) * 2 - 1
        const length = Math.hypot(x, y)
        if (length > 1) { x /= length; y /= length }
        ref.current = { x, y }
        if (mode === 'aim') aimRef.current.angle = Math.atan2(y, x)
      }
      update(event.clientX, event.clientY)
      element.onpointermove = (moveEvent) => update(moveEvent.clientX, moveEvent.clientY)
    },
    onPointerUp: (event) => {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
      if (mode === 'move') ref.current = { x: 0, y: 0 }
      event.currentTarget.onpointermove = null
    },
    onPointerCancel: () => {
      if (mode === 'move') ref.current = { x: 0, y: 0 }
    },
  })

  const mission = MISSIONS[missionIndex] || MISSIONS[MISSIONS.length - 1]
  const displayedProgress = mission.kind === 'escort'
    ? `${Math.floor(missionProgress)}/${mission.target}s · Convoy ${escortHealth}%`
    : `${Math.min(Math.floor(missionProgress), mission.target)}/${mission.target}`

  return (
    <section className="screen helicopter-screen">
      <div className="helicopter-shell">
        <div className="helicopter-header">
          <button className="secondary-button" type="button" onClick={onBack}>← Back</button>
          <h2>Helicopter Assault</h2>
          <div className="score-pill helicopter-best">Best: {best}</div>
        </div>

        <div className="helicopter-mission">
          <div>
            <span>Mission {missionIndex + 1}/{MISSIONS.length}</span>
            <strong>{mission.title}</strong>
            <small>{mission.description}</small>
          </div>
          <b>{displayedProgress}</b>
        </div>

        <div className="helicopter-hud">
          <span>Score <strong>{score}</strong></span>
          <span>❤️ <strong>{health}</strong></span>
          <span>🚀 <strong>{rocketsLeft}/{MAX_ROCKETS}</strong></span>
        </div>

        <div className="helicopter-canvas-wrap">
          <canvas
            ref={canvasRef}
            className="helicopter-canvas"
            width={WIDTH}
            height={HEIGHT}
            aria-label={`Helicopter Assault. Mission ${missionIndex + 1}. Score ${score}. Health ${health}.`}
          />
          {notice && <div className="helicopter-notice">{notice}</div>}
        </div>

        <div className="helicopter-mobile-controls">
          <div className="helicopter-stick" {...bindStick(moveStickRef, 'move')}><span>MOVE</span></div>
          <div className="helicopter-mobile-buttons">
            <button className="primary-button" type="button" onPointerDown={fireGun}>GUN</button>
            <button className="secondary-button" type="button" onPointerDown={fireRocket}>ROCKET</button>
          </div>
          <div className="helicopter-stick" {...bindStick(aimStickRef, 'aim')}><span>AIM</span></div>
        </div>

        <div className="helicopter-actions">
          {(status === 'gameover' || status === 'victory') ? (
            <button className="primary-button" type="button" onClick={startGame}>Play campaign again</button>
          ) : status === 'ready' ? (
            <button className="primary-button" type="button" onClick={startGame}>Start campaign</button>
          ) : (
            <button className="secondary-button" type="button" onClick={resetGame}>Restart campaign</button>
          )}
        </div>

        <p className="helicopter-help">⌨️ WASD move · Mouse aim · Left click machine gun · Right click / Q rockets · Shift boost</p>
      </div>
    </section>
  )
}
