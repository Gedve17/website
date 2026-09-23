import { useCallback, useEffect, useRef, useState } from 'react'
import './ZombieGame.css'

const WIDTH = 680
const HEIGHT = 620
const PLAYER_RADIUS = 16
const MAX_HEALTH = 100

const clamp = (value, min, max) => Math.max(min, Math.min(max, value))
const random = (min, max) => min + Math.random() * (max - min)

const WEAPONS = [
  { name: 'Pistol', unlock: 0, mag: 12, reserve: 72, fireDelay: 0.24, reload: 1.05, damage: 34, speed: 690, pellets: 1, spread: 0.02 },
  { name: 'SMG', unlock: 12, mag: 28, reserve: 168, fireDelay: 0.09, reload: 1.3, damage: 18, speed: 720, pellets: 1, spread: 0.055 },
  { name: 'Shotgun', unlock: 28, mag: 7, reserve: 49, fireDelay: 0.68, reload: 1.55, damage: 20, speed: 650, pellets: 7, spread: 0.22 },
  { name: 'Rifle', unlock: 48, mag: 24, reserve: 144, fireDelay: 0.14, reload: 1.4, damage: 30, speed: 790, pellets: 1, spread: 0.025 },
  { name: 'Minigun', unlock: 80, mag: 90, reserve: 360, fireDelay: 0.055, reload: 2.1, damage: 14, speed: 820, pellets: 1, spread: 0.075 },
]

function loadBest() {
  try {
    return Number(localStorage.getItem('y9-zombie-best') || 0)
  } catch {
    return 0
  }
}

function zombieStats(type, wave) {
  const scale = 1 + Math.min(wave * 0.055, 0.7)
  if (type === 'runner') return { radius: 13, hp: 46 * scale, speed: 92 + wave * 2.2, damage: 9, color: '#f59f00' }
  if (type === 'tank') return { radius: 23, hp: 210 * scale, speed: 31 + wave * 0.7, damage: 20, color: '#7f5539' }
  if (type === 'exploder') return { radius: 18, hp: 82 * scale, speed: 48 + wave * 1.1, damage: 14, color: '#c92a2a' }
  if (type === 'boss') return { radius: 36, hp: 760 * scale, speed: 28 + wave * 0.6, damage: 28, color: '#862e9c' }
  return { radius: 16, hp: 74 * scale, speed: 48 + wave * 1.25, damage: 12, color: '#5c940d' }
}

function createZombie(wave, typeOverride = null) {
  let type = typeOverride
  if (!type) {
    const roll = Math.random()
    if (wave >= 4 && roll < 0.09) type = 'exploder'
    else if (wave >= 3 && roll < 0.22) type = 'tank'
    else if (wave >= 2 && roll < 0.42) type = 'runner'
    else type = 'normal'
  }

  const side = Math.floor(Math.random() * 4)
  const margin = 45
  let x
  let y
  if (side === 0) { x = random(0, WIDTH); y = -margin }
  if (side === 1) { x = WIDTH + margin; y = random(0, HEIGHT) }
  if (side === 2) { x = random(0, WIDTH); y = HEIGHT + margin }
  if (side === 3) { x = -margin; y = random(0, HEIGHT) }

  const stats = zombieStats(type, wave)
  return {
    id: Math.random().toString(36).slice(2),
    type,
    x,
    y,
    ...stats,
    maxHp: stats.hp,
    hitFlash: 0,
  }
}

function createAmmoState() {
  return WEAPONS.map((weapon) => ({ mag: weapon.mag, reserve: weapon.reserve }))
}

export default function ZombieGame({ onBack, onScoreSubmit }) {
  const canvasRef = useRef(null)
  const frameRef = useRef(null)
  const keysRef = useRef(new Set())
  const statusRef = useRef('ready')
  const pausedRef = useRef(false)
  const playerRef = useRef({ x: WIDTH / 2, y: HEIGHT / 2, health: MAX_HEALTH, invulnerable: 0 })
  const zombiesRef = useRef([])
  const bulletsRef = useRef([])
  const effectsRef = useRef([])
  const aimRef = useRef({ x: WIDTH / 2 + 100, y: HEIGHT / 2, angle: 0 })
  const pointerDownRef = useRef(false)
  const moveStickRef = useRef({ x: 0, y: 0 })
  const aimStickRef = useRef({ x: 1, y: 0 })
  const scoreRef = useRef(0)
  const waveRef = useRef(1)
  const spawnTimerRef = useRef(0)
  const fireTimerRef = useRef(0)
  const reloadTimerRef = useRef(0)
  const reloadingRef = useRef(false)
  const weaponIndexRef = useRef(0)
  const ammoRef = useRef(createAmmoState())
  const bossWaveSpawnedRef = useRef(new Set())
  const lastTimeRef = useRef(null)
  const bestRef = useRef(loadBest())
  const submittedRef = useRef(false)

  const [status, setStatus] = useState('ready')
  const [score, setScore] = useState(0)
  const [wave, setWave] = useState(1)
  const [health, setHealth] = useState(MAX_HEALTH)
  const [best, setBest] = useState(bestRef.current)
  const [weaponIndex, setWeaponIndex] = useState(0)
  const [ammo, setAmmo] = useState(createAmmoState())
  const [reloading, setReloading] = useState(false)
  const [notice, setNotice] = useState('WASD to move · mouse to aim')

  const saveBest = useCallback((value) => {
    if (value <= bestRef.current) return
    bestRef.current = value
    setBest(value)
    try {
      localStorage.setItem('y9-zombie-best', String(value))
    } catch {
      // Ignore storage failures.
    }
  }, [])

  const syncAmmo = useCallback(() => {
    setAmmo(ammoRef.current.map((entry) => ({ ...entry })))
  }, [])

  const resetGame = useCallback(() => {
    statusRef.current = 'ready'
    submittedRef.current = false
    playerRef.current = { x: WIDTH / 2, y: HEIGHT / 2, health: MAX_HEALTH, invulnerable: 0 }
    zombiesRef.current = []
    bulletsRef.current = []
    effectsRef.current = []
    aimRef.current = { x: WIDTH / 2 + 100, y: HEIGHT / 2, angle: 0 }
    moveStickRef.current = { x: 0, y: 0 }
    aimStickRef.current = { x: 1, y: 0 }
    scoreRef.current = 0
    waveRef.current = 1
    spawnTimerRef.current = 0.35
    fireTimerRef.current = 0
    reloadTimerRef.current = 0
    reloadingRef.current = false
    weaponIndexRef.current = 0
    ammoRef.current = createAmmoState()
    bossWaveSpawnedRef.current = new Set()
    lastTimeRef.current = null

    setStatus('ready')
    setScore(0)
    setWave(1)
    setHealth(MAX_HEALTH)
    setWeaponIndex(0)
    setAmmo(createAmmoState())
    setReloading(false)
    setNotice('WASD to move · mouse to aim')
  }, [])

  const startGame = useCallback(() => {
    resetGame()
    statusRef.current = 'playing'
    setStatus('playing')
    setNotice('')
  }, [resetGame])

  const endGame = useCallback(() => {
    statusRef.current = 'gameover'
    setStatus('gameover')
    setNotice(`Overrun on wave ${waveRef.current}`)
    saveBest(scoreRef.current)
    if (!submittedRef.current) {
      submittedRef.current = true
      onScoreSubmit?.('zombie', scoreRef.current)
    }
  }, [onScoreSubmit, saveBest])

  const startReload = useCallback(() => {
    if (statusRef.current !== 'playing' || reloadingRef.current) return
    const weapon = WEAPONS[weaponIndexRef.current]
    const ammoState = ammoRef.current[weaponIndexRef.current]
    if (ammoState.mag >= weapon.mag || ammoState.reserve <= 0) return
    reloadingRef.current = true
    reloadTimerRef.current = weapon.reload
    setReloading(true)
  }, [])

  const selectWeapon = useCallback((index) => {
    const weapon = WEAPONS[index]
    if (!weapon || scoreRef.current < weapon.unlock) return
    weaponIndexRef.current = index
    reloadingRef.current = false
    reloadTimerRef.current = 0
    setReloading(false)
    setWeaponIndex(index)
  }, [])

  const fire = useCallback(() => {
    if (statusRef.current === 'ready') {
      statusRef.current = 'playing'
      setStatus('playing')
      setNotice('')
    }
    if (statusRef.current !== 'playing' || reloadingRef.current || fireTimerRef.current > 0) return

    const index = weaponIndexRef.current
    const weapon = WEAPONS[index]
    const ammoState = ammoRef.current[index]
    if (ammoState.mag <= 0) {
      startReload()
      return
    }

    ammoState.mag -= 1
    fireTimerRef.current = weapon.fireDelay
    const player = playerRef.current
    const baseAngle = aimRef.current.angle

    for (let i = 0; i < weapon.pellets; i += 1) {
      const spread = (Math.random() - 0.5) * weapon.spread * 2
      const angle = baseAngle + spread
      bulletsRef.current.push({
        id: Math.random().toString(36).slice(2),
        x: player.x + Math.cos(angle) * 22,
        y: player.y + Math.sin(angle) * 22,
        vx: Math.cos(angle) * weapon.speed,
        vy: Math.sin(angle) * weapon.speed,
        damage: weapon.damage,
        life: 1.2,
      })
    }

    syncAmmo()
    if (ammoState.mag <= 0 && ammoState.reserve > 0) startReload()
  }, [startReload, syncAmmo])

  useEffect(() => {
    const handleKeyDown = (event) => {
      keysRef.current.add(event.key.toLowerCase())
      if (event.key.toLowerCase() === 'r') startReload()
      if (/^[1-5]$/.test(event.key)) selectWeapon(Number(event.key) - 1)
      if (event.code === 'Space' && statusRef.current === 'gameover') {
        event.preventDefault()
        startGame()
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
  }, [selectWeapon, startGame, startReload])

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

    const onPointerMove = (event) => {
      const point = pointerToCanvas(event)
      const player = playerRef.current
      aimRef.current = {
        x: point.x,
        y: point.y,
        angle: Math.atan2(point.y - player.y, point.x - player.x),
      }
    }
    const onPointerDown = (event) => {
      if (event.button !== 0) return
      pointerDownRef.current = true
      onPointerMove(event)
      fire()
    }
    const onPointerUp = () => { pointerDownRef.current = false }
    const preventContext = (event) => event.preventDefault()

    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('contextmenu', preventContext)
    return () => {
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('contextmenu', preventContext)
    }
  }, [fire])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined
    const ctx = canvas.getContext('2d')

    const drawArena = () => {
      ctx.fillStyle = '#172016'
      ctx.fillRect(0, 0, WIDTH, HEIGHT)

      ctx.strokeStyle = 'rgba(143, 174, 90, 0.12)'
      ctx.lineWidth = 1
      const grid = 46
      for (let x = 0; x <= WIDTH; x += grid) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, HEIGHT)
        ctx.stroke()
      }
      for (let y = 0; y <= HEIGHT; y += grid) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(WIDTH, y)
        ctx.stroke()
      }

      ctx.fillStyle = 'rgba(68, 92, 57, 0.34)'
      for (let i = 0; i < 28; i += 1) {
        const x = (i * 127) % WIDTH
        const y = (i * 223) % HEIGHT
        ctx.beginPath()
        ctx.arc(x, y, 8 + (i % 4) * 3, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    const drawPlayer = () => {
      const player = playerRef.current
      ctx.save()
      ctx.translate(player.x, player.y)
      ctx.rotate(aimRef.current.angle)
      ctx.fillStyle = player.invulnerable > 0 && Math.floor(player.invulnerable * 15) % 2 === 0 ? '#ffffff' : '#4dabf7'
      ctx.beginPath()
      ctx.arc(0, 0, PLAYER_RADIUS, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#d0ebff'
      ctx.fillRect(6, -4, 25, 8)
      ctx.fillStyle = '#1c7ed6'
      ctx.beginPath()
      ctx.arc(-4, -4, 4, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }

    const drawZombie = (zombie) => {
      ctx.save()
      ctx.translate(zombie.x, zombie.y)
      ctx.fillStyle = zombie.hitFlash > 0 ? '#ffffff' : zombie.color
      ctx.beginPath()
      ctx.arc(0, 0, zombie.radius, 0, Math.PI * 2)
      ctx.fill()

      ctx.fillStyle = '#d8f5a2'
      ctx.beginPath()
      ctx.arc(-zombie.radius * 0.28, -zombie.radius * 0.18, Math.max(2, zombie.radius * 0.12), 0, Math.PI * 2)
      ctx.arc(zombie.radius * 0.28, -zombie.radius * 0.18, Math.max(2, zombie.radius * 0.12), 0, Math.PI * 2)
      ctx.fill()

      if (zombie.type !== 'normal') {
        const label = zombie.type === 'runner' ? 'R' : zombie.type === 'tank' ? 'T' : zombie.type === 'exploder' ? '!' : 'BOSS'
        ctx.fillStyle = '#fff'
        ctx.font = `900 ${zombie.type === 'boss' ? 11 : 9}px system-ui`
        ctx.textAlign = 'center'
        ctx.fillText(label, 0, zombie.radius + 13)
      }

      if (zombie.hp < zombie.maxHp) {
        const width = zombie.radius * 2
        ctx.fillStyle = 'rgba(0,0,0,.45)'
        ctx.fillRect(-width / 2, -zombie.radius - 10, width, 4)
        ctx.fillStyle = '#69db7c'
        ctx.fillRect(-width / 2, -zombie.radius - 10, width * clamp(zombie.hp / zombie.maxHp, 0, 1), 4)
      }
      ctx.restore()
    }

    const drawEffects = () => {
      for (const effect of effectsRef.current) {
        ctx.globalAlpha = clamp(effect.life / effect.maxLife, 0, 1)
        ctx.strokeStyle = effect.color
        ctx.lineWidth = 4
        ctx.beginPath()
        ctx.arc(effect.x, effect.y, effect.radius * (1 - effect.life / effect.maxLife), 0, Math.PI * 2)
        ctx.stroke()
      }
      ctx.globalAlpha = 1
    }

    const render = () => {
      drawArena()
      for (const bullet of bulletsRef.current) {
        ctx.fillStyle = '#ffd43b'
        ctx.beginPath()
        ctx.arc(bullet.x, bullet.y, 3.2, 0, Math.PI * 2)
        ctx.fill()
      }
      zombiesRef.current.forEach(drawZombie)
      drawEffects()
      drawPlayer()

      if (statusRef.current !== 'playing') {
        ctx.fillStyle = 'rgba(5, 10, 4, 0.58)'
        ctx.fillRect(0, 0, WIDTH, HEIGHT)
        ctx.fillStyle = '#fff'
        ctx.textAlign = 'center'
        ctx.font = '900 36px system-ui'
        ctx.fillText(statusRef.current === 'gameover' ? 'OVERRUN' : 'ZOMBIE OUTBREAK', WIDTH / 2, HEIGHT / 2 - 15)
        ctx.font = '700 16px system-ui'
        ctx.fillText(statusRef.current === 'gameover' ? `Kills: ${scoreRef.current}` : 'Click Start or fire to begin', WIDTH / 2, HEIGHT / 2 + 22)
      }
    }

    const update = (delta) => {
      if (statusRef.current !== 'playing' || pausedRef.current) return

      if (pointerDownRef.current) fire()
      fireTimerRef.current = Math.max(0, fireTimerRef.current - delta)

      if (reloadingRef.current) {
        reloadTimerRef.current -= delta
        if (reloadTimerRef.current <= 0) {
          const index = weaponIndexRef.current
          const weapon = WEAPONS[index]
          const state = ammoRef.current[index]
          const needed = weapon.mag - state.mag
          const moved = Math.min(needed, state.reserve)
          state.mag += moved
          state.reserve -= moved
          reloadingRef.current = false
          setReloading(false)
          syncAmmo()
        }
      }

      const player = playerRef.current
      const keys = keysRef.current
      let moveX = moveStickRef.current.x
      let moveY = moveStickRef.current.y
      if (keys.has('a') || keys.has('arrowleft')) moveX -= 1
      if (keys.has('d') || keys.has('arrowright')) moveX += 1
      if (keys.has('w') || keys.has('arrowup')) moveY -= 1
      if (keys.has('s') || keys.has('arrowdown')) moveY += 1
      const moveLength = Math.hypot(moveX, moveY) || 1
      if (Math.abs(moveX) > 0.01 || Math.abs(moveY) > 0.01) {
        const speed = 205
        player.x = clamp(player.x + (moveX / moveLength) * speed * delta, PLAYER_RADIUS, WIDTH - PLAYER_RADIUS)
        player.y = clamp(player.y + (moveY / moveLength) * speed * delta, PLAYER_RADIUS, HEIGHT - PLAYER_RADIUS)
      }
      player.invulnerable = Math.max(0, player.invulnerable - delta)

      if (Math.hypot(aimStickRef.current.x, aimStickRef.current.y) > 0.2) {
        aimRef.current.angle = Math.atan2(aimStickRef.current.y, aimStickRef.current.x)
      } else {
        aimRef.current.angle = Math.atan2(aimRef.current.y - player.y, aimRef.current.x - player.x)
      }

      const nextWave = 1 + Math.floor(scoreRef.current / 10)
      if (nextWave !== waveRef.current) {
        waveRef.current = nextWave
        setWave(nextWave)
        setNotice(`Wave ${nextWave}`)
        window.setTimeout(() => setNotice(''), 900)
      }

      if (nextWave % 5 === 0 && !bossWaveSpawnedRef.current.has(nextWave)) {
        zombiesRef.current.push(createZombie(nextWave, 'boss'))
        bossWaveSpawnedRef.current.add(nextWave)
      }

      spawnTimerRef.current -= delta
      if (spawnTimerRef.current <= 0) {
        zombiesRef.current.push(createZombie(nextWave))
        if (nextWave >= 6 && Math.random() < 0.24) zombiesRef.current.push(createZombie(nextWave))
        spawnTimerRef.current = Math.max(0.22, 0.92 - nextWave * 0.045) * random(0.75, 1.2)
      }

      bulletsRef.current = bulletsRef.current
        .map((bullet) => ({ ...bullet, x: bullet.x + bullet.vx * delta, y: bullet.y + bullet.vy * delta, life: bullet.life - delta }))
        .filter((bullet) => bullet.life > 0 && bullet.x > -20 && bullet.x < WIDTH + 20 && bullet.y > -20 && bullet.y < HEIGHT + 20)

      const survivors = []
      for (const zombie of zombiesRef.current) {
        let nextZombie = { ...zombie, hitFlash: Math.max(0, zombie.hitFlash - delta) }
        const dx = player.x - nextZombie.x
        const dy = player.y - nextZombie.y
        const distance = Math.hypot(dx, dy) || 1
        nextZombie.x += (dx / distance) * nextZombie.speed * delta
        nextZombie.y += (dy / distance) * nextZombie.speed * delta

        for (const bullet of bulletsRef.current) {
          if (bullet.dead) continue
          if (Math.hypot(bullet.x - nextZombie.x, bullet.y - nextZombie.y) <= nextZombie.radius + 4) {
            nextZombie.hp -= bullet.damage
            nextZombie.hitFlash = 0.08
            bullet.dead = true
          }
        }

        if (nextZombie.hp <= 0) {
          scoreRef.current += nextZombie.type === 'boss' ? 8 : nextZombie.type === 'tank' ? 2 : 1
          setScore(scoreRef.current)
          if (nextZombie.type === 'exploder') {
            effectsRef.current.push({ x: nextZombie.x, y: nextZombie.y, radius: 110, life: 0.34, maxLife: 0.34, color: '#ff8787' })
            if (Math.hypot(player.x - nextZombie.x, player.y - nextZombie.y) < 100 && player.invulnerable <= 0) {
              player.health -= 22
              player.invulnerable = 0.65
              setHealth(Math.max(0, Math.round(player.health)))
            }
          }
          continue
        }

        if (distance < nextZombie.radius + PLAYER_RADIUS + 2 && player.invulnerable <= 0) {
          player.health -= nextZombie.damage
          player.invulnerable = 0.65
          setHealth(Math.max(0, Math.round(player.health)))
        }

        survivors.push(nextZombie)
      }
      zombiesRef.current = survivors
      bulletsRef.current = bulletsRef.current.filter((bullet) => !bullet.dead)

      effectsRef.current = effectsRef.current
        .map((effect) => ({ ...effect, life: effect.life - delta }))
        .filter((effect) => effect.life > 0)

      if (player.health <= 0) endGame()
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
  }, [endGame, fire, syncAmmo])

  const currentWeapon = WEAPONS[weaponIndex]
  const currentAmmo = ammo[weaponIndex] || { mag: 0, reserve: 0 }

  const bindStick = (ref, mode) => ({
    onPointerDown: (event) => {
      event.currentTarget.setPointerCapture(event.pointerId)
      const rect = event.currentTarget.getBoundingClientRect()
      const update = (clientX, clientY) => {
        let x = ((clientX - rect.left) / rect.width) * 2 - 1
        let y = ((clientY - rect.top) / rect.height) * 2 - 1
        const length = Math.hypot(x, y)
        if (length > 1) { x /= length; y /= length }
        ref.current = { x, y }
        if (mode === 'aim' && statusRef.current === 'ready') {
          statusRef.current = 'playing'
          setStatus('playing')
          setNotice('')
        }
      }
      update(event.clientX, event.clientY)
      event.currentTarget.onpointermove = (moveEvent) => update(moveEvent.clientX, moveEvent.clientY)
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

  return (
    <section className="screen zombie-screen">
      <div className="zombie-shell">
        <div className="zombie-header">
          <button className="secondary-button" type="button" onClick={onBack}>← Back</button>
          <h2>Zombie Outbreak</h2>
          <div className="score-pill zombie-best">Best: {best}</div>
        </div>

        <div className="zombie-hud">
          <span>Wave <strong>{wave}</strong></span>
          <span>Kills <strong>{score}</strong></span>
          <span>❤️ <strong>{health}</strong></span>
          <span>{currentWeapon.name} <strong>{currentAmmo.mag}/{currentAmmo.reserve}</strong>{reloading ? ' · reloading' : ''}</span>
        </div>

        <div className="zombie-canvas-wrap">
          <canvas
            ref={canvasRef}
            className="zombie-canvas"
            width={WIDTH}
            height={HEIGHT}
            aria-label={`Zombie Outbreak. Wave ${wave}. Kills ${score}. Health ${health}.`}
          />
          {notice && <div className="zombie-notice">{notice}</div>}
        </div>

        <div className="zombie-weapons">
          {WEAPONS.map((weapon, index) => {
            const locked = score < weapon.unlock
            return (
              <button
                key={weapon.name}
                type="button"
                className={index === weaponIndex ? 'zombie-weapon-active' : ''}
                onClick={() => selectWeapon(index)}
                disabled={locked}
                title={locked ? `Unlock at ${weapon.unlock} kills` : weapon.name}
              >
                {index + 1}. {weapon.name}{locked ? ` 🔒${weapon.unlock}` : ''}
              </button>
            )
          })}
        </div>

        <div className="zombie-mobile-controls">
          <div className="zombie-stick" {...bindStick(moveStickRef, 'move')}>
            <span>MOVE</span>
          </div>
          <div className="zombie-mobile-buttons">
            <button className="primary-button" type="button" onPointerDown={fire}>FIRE</button>
            <button className="secondary-button" type="button" onClick={startReload}>RELOAD</button>
          </div>
          <div className="zombie-stick" {...bindStick(aimStickRef, 'aim')}>
            <span>AIM</span>
          </div>
        </div>

        <div className="zombie-actions">
          {status === 'gameover' ? (
            <button className="primary-button" type="button" onClick={startGame}>Play again</button>
          ) : status === 'ready' ? (
            <button className="primary-button" type="button" onClick={startGame}>Start</button>
          ) : (
            <button className="secondary-button" type="button" onClick={resetGame}>Restart</button>
          )}
        </div>

        <p className="zombie-help">⌨️ WASD move · Mouse aim · Left click shoot · R reload · 1–5 weapons</p>
      </div>
    </section>
  )
}
