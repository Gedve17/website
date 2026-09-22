import { useCallback, useEffect, useRef, useState } from 'react'
import './MilitaryGame.css'

const LANES = [22, 50, 78]
const PLAYER_X = 12
const BULLET_SPEED = 130
const FIRE_COOLDOWN = 240
const START_HEALTH = 100

function createEnemy(wave) {
  const speed = 5 + Math.random() * 3 + Math.min(wave * 0.5, 8)
  return {
    id: Math.random().toString(36).slice(2),
    lane: Math.floor(Math.random() * 3),
    x: 104,
    speed,
    hp: Math.random() < 0.2 ? 2 : 1,
  }
}

export default function MilitaryGame({ onBack }) {
  const [playerLane, setPlayerLane] = useState(1)
  const [enemies, setEnemies] = useState([])
  const [bullets, setBullets] = useState([])
  const [score, setScore] = useState(0)
  const [health, setHealth] = useState(START_HEALTH)
  const [best, setBest] = useState(0)
  const [status, setStatus] = useState('ready')

  const playerLaneRef = useRef(1)
  const enemiesRef = useRef([])
  const bulletsRef = useRef([])
  const statusRef = useRef('ready')
  const scoreRef = useRef(0)
  const healthRef = useRef(START_HEALTH)
  const spawnTimerRef = useRef(0)
  const fireCooldownRef = useRef(0)
  const lastTimeRef = useRef(null)
  const animationFrameRef = useRef(null)
  const touchStartRef = useRef(null)

  const syncEnemies = useCallback((next) => {
    enemiesRef.current = next
    setEnemies(next)
  }, [])

  const syncBullets = useCallback((next) => {
    bulletsRef.current = next
    setBullets(next)
  }, [])

  const resetGame = useCallback(() => {
    playerLaneRef.current = 1
    enemiesRef.current = []
    bulletsRef.current = []
    statusRef.current = 'ready'
    scoreRef.current = 0
    healthRef.current = START_HEALTH
    spawnTimerRef.current = 0
    fireCooldownRef.current = 0
    lastTimeRef.current = null

    setPlayerLane(1)
    setEnemies([])
    setBullets([])
    setScore(0)
    setHealth(START_HEALTH)
    setStatus('ready')
  }, [])

  const startGame = useCallback(() => {
    resetGame()
    statusRef.current = 'playing'
    setStatus('playing')
  }, [resetGame])

  const endGame = useCallback(() => {
    statusRef.current = 'gameover'
    setStatus('gameover')
    setBest((currentBest) => Math.max(currentBest, scoreRef.current))
  }, [])

  const moveLane = useCallback((direction) => {
    if (statusRef.current === 'gameover') return
    if (statusRef.current === 'ready') {
      statusRef.current = 'playing'
      setStatus('playing')
    }
    const next = Math.max(0, Math.min(2, playerLaneRef.current + direction))
    playerLaneRef.current = next
    setPlayerLane(next)
  }, [])

  const fire = useCallback(() => {
    if (statusRef.current === 'ready') {
      statusRef.current = 'playing'
      setStatus('playing')
    }
    if (statusRef.current !== 'playing') return
    if (fireCooldownRef.current > 0) return

    fireCooldownRef.current = FIRE_COOLDOWN
    syncBullets([
      ...bulletsRef.current,
      {
        id: Math.random().toString(36).slice(2),
        lane: playerLaneRef.current,
        x: PLAYER_X + 7,
      },
    ])
  }, [syncBullets])

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'ArrowUp' || event.key === 'w' || event.key === 'W') {
        event.preventDefault()
        moveLane(-1)
      } else if (event.key === 'ArrowDown' || event.key === 's' || event.key === 'S') {
        event.preventDefault()
        moveLane(1)
      } else if (event.code === 'Space') {
        event.preventDefault()
        if (statusRef.current === 'gameover') startGame()
        else fire()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [moveLane, fire, startGame])

  useEffect(() => {
    if (status !== 'playing') return undefined

    const tick = (time) => {
      if (statusRef.current !== 'playing') return

      if (lastTimeRef.current == null) lastTimeRef.current = time
      const delta = Math.min((time - lastTimeRef.current) / 1000, 0.05)
      lastTimeRef.current = time

      if (fireCooldownRef.current > 0) {
        fireCooldownRef.current = Math.max(0, fireCooldownRef.current - delta * 1000)
      }

      let nextBullets = bulletsRef.current
        .map((bullet) => ({ ...bullet, x: bullet.x + BULLET_SPEED * delta }))
        .filter((bullet) => bullet.x < 106)

      let nextEnemies = enemiesRef.current.map((enemy) => ({
        ...enemy,
        x: enemy.x - enemy.speed * delta,
      }))

      spawnTimerRef.current -= delta
      if (spawnTimerRef.current <= 0) {
        const wave = Math.floor(scoreRef.current / 8)
        nextEnemies = [...nextEnemies, createEnemy(wave)]
        spawnTimerRef.current = Math.max(0.5, 1.5 - wave * 0.08)
      }

      const survivingEnemies = []
      let gained = 0
      let damage = 0

      nextEnemies.forEach((enemy) => {
        let hp = enemy.hp
        let hitBulletId = null

        for (const bullet of nextBullets) {
          if (bullet.lane !== enemy.lane) continue
          if (Math.abs(bullet.x - enemy.x) < 6) {
            hitBulletId = bullet.id
            hp -= 1
            break
          }
        }

        if (hitBulletId) {
          nextBullets = nextBullets.filter((bullet) => bullet.id !== hitBulletId)
        }

        if (hp <= 0) {
          gained += 1
          return
        }

        if (enemy.x <= PLAYER_X - 2) {
          damage += 20
          return
        }

        survivingEnemies.push({ ...enemy, hp })
      })

      if (gained > 0) {
        scoreRef.current += gained
        setScore(scoreRef.current)
      }

      if (damage > 0) {
        healthRef.current = Math.max(0, healthRef.current - damage)
        setHealth(healthRef.current)
      }

      syncEnemies(survivingEnemies)
      syncBullets(nextBullets)

      if (healthRef.current <= 0) {
        endGame()
        return
      }

      animationFrameRef.current = requestAnimationFrame(tick)
    }

    animationFrameRef.current = requestAnimationFrame(tick)

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
      lastTimeRef.current = null
    }
  }, [status, endGame, syncEnemies, syncBullets])

  const handleTouchStart = (event) => {
    const touch = event.touches[0]
    if (!touch) return
    touchStartRef.current = touch.clientY
  }

  const handleTouchEnd = (event) => {
    if (touchStartRef.current == null) return
    const touch = event.changedTouches[0]
    if (!touch) return

    const deltaY = touch.clientY - touchStartRef.current
    touchStartRef.current = null

    if (Math.abs(deltaY) < 26) {
      if (statusRef.current === 'gameover') startGame()
      else fire()
      return
    }

    moveLane(deltaY > 0 ? 1 : -1)
  }

  return (
    <section className="screen military-screen">
      <div className="military-shell">
        <div className="military-header">
          <button className="secondary-button" type="button" onClick={onBack}>
            ← Back
          </button>

          <h2>Base Defense</h2>

          <div className="score-pill military-score">Best: {best}</div>
        </div>

        <div className="military-hud">
          <span>Score: {score}</span>
          <div className="military-health-bar" aria-label={`Base health ${health}%`}>
            <div className="military-health-fill" style={{ width: `${health}%` }} />
          </div>
        </div>

        <div
          className="military-stage"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          aria-label={`Base defense game. Score ${score}. Health ${health}.`}
        >
          <div className="military-lane-line military-lane-line-1" aria-hidden="true" />
          <div className="military-lane-line military-lane-line-2" aria-hidden="true" />

          <div className="military-base" aria-hidden="true" />

          {enemies.map((enemy) => (
            <div
              key={enemy.id}
              className={`military-enemy ${enemy.hp > 1 ? 'military-enemy-tough' : ''}`}
              style={{ left: `${enemy.x}%`, top: `${LANES[enemy.lane]}%` }}
              aria-hidden="true"
            >
              <span className="military-turret" />
              <span className="military-tread" />
            </div>
          ))}

          {bullets.map((bullet) => (
            <div
              key={bullet.id}
              className="military-bullet"
              style={{ left: `${bullet.x}%`, top: `${LANES[bullet.lane]}%` }}
              aria-hidden="true"
            />
          ))}

          <div
            className="military-player"
            style={{ left: `${PLAYER_X}%`, top: `${LANES[playerLane]}%` }}
            aria-hidden="true"
          >
            <span className="military-turret military-turret-player" />
            <span className="military-tread" />
          </div>

          {status !== 'playing' && (
            <div className="military-overlay">
              <strong>{status === 'gameover' ? 'BASE LOST' : 'HOLD THE LINE'}</strong>
              <span>
                {status === 'gameover'
                  ? `Score ${score} · Tap to retry`
                  : 'Switch lanes, fire at will'}
              </span>
            </div>
          )}
        </div>

        <div className="military-actions">
          {status === 'gameover' ? (
            <button className="primary-button" type="button" onClick={startGame}>
              Play again
            </button>
          ) : (
            <>
              <button className="primary-button military-fire-button" type="button" onClick={fire}>
                Fire
              </button>
              <button className="secondary-button" type="button" onClick={resetGame}>
                Restart
              </button>
            </>
          )}
        </div>

        <div className="military-pad">
          <button type="button" onClick={() => moveLane(-1)} aria-label="Move up a lane">
            ↑
          </button>
          <button type="button" onClick={() => moveLane(1)} aria-label="Move down a lane">
            ↓
          </button>
        </div>

        <p className="military-help">
          <span>⌨️ ↑ ↓ / W S · Space to fire</span>
          <span>📱 Swipe up/down · tap to fire</span>
        </p>
      </div>
    </section>
  )
}
