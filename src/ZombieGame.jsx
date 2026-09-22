import { useCallback, useEffect, useRef, useState } from 'react'
import './ZombieGame.css'

const PLAYER_Y = 92
const BULLET_SPEED = 130
const FIRE_COOLDOWN = 260
const START_LIVES = 3

function createZombie(wave) {
  const speed = 6 + Math.random() * 4 + Math.min(wave * 0.6, 10)
  return {
    id: Math.random().toString(36).slice(2),
    x: 8 + Math.random() * 84,
    y: -8,
    speed,
    hp: Math.random() < 0.18 ? 2 : 1,
  }
}

export default function ZombieGame({ onBack }) {
  const [playerX, setPlayerX] = useState(50)
  const [zombies, setZombies] = useState([])
  const [bullets, setBullets] = useState([])
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(START_LIVES)
  const [best, setBest] = useState(0)
  const [status, setStatus] = useState('ready')

  const playerXRef = useRef(50)
  const zombiesRef = useRef([])
  const bulletsRef = useRef([])
  const statusRef = useRef('ready')
  const scoreRef = useRef(0)
  const livesRef = useRef(START_LIVES)
  const spawnTimerRef = useRef(0)
  const fireCooldownRef = useRef(0)
  const lastTimeRef = useRef(null)
  const animationFrameRef = useRef(null)
  const moveDirRef = useRef(0)
  const touchStartRef = useRef(null)

  const syncZombies = useCallback((next) => {
    zombiesRef.current = next
    setZombies(next)
  }, [])

  const syncBullets = useCallback((next) => {
    bulletsRef.current = next
    setBullets(next)
  }, [])

  const resetGame = useCallback(() => {
    playerXRef.current = 50
    zombiesRef.current = []
    bulletsRef.current = []
    statusRef.current = 'ready'
    scoreRef.current = 0
    livesRef.current = START_LIVES
    spawnTimerRef.current = 0
    fireCooldownRef.current = 0
    lastTimeRef.current = null
    moveDirRef.current = 0

    setPlayerX(50)
    setZombies([])
    setBullets([])
    setScore(0)
    setLives(START_LIVES)
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
      { id: Math.random().toString(36).slice(2), x: playerXRef.current, y: PLAYER_Y - 4 },
    ])
  }, [syncBullets])

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'ArrowLeft' || event.key === 'a' || event.key === 'A') {
        event.preventDefault()
        moveDirRef.current = -1
      } else if (event.key === 'ArrowRight' || event.key === 'd' || event.key === 'D') {
        event.preventDefault()
        moveDirRef.current = 1
      } else if (event.code === 'Space') {
        event.preventDefault()
        if (statusRef.current === 'gameover') startGame()
        else fire()
      }
    }

    const handleKeyUp = (event) => {
      if (['ArrowLeft', 'a', 'A'].includes(event.key) && moveDirRef.current === -1) {
        moveDirRef.current = 0
      }
      if (['ArrowRight', 'd', 'D'].includes(event.key) && moveDirRef.current === 1) {
        moveDirRef.current = 0
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [fire, startGame])

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

      if (moveDirRef.current !== 0) {
        playerXRef.current = Math.max(
          6,
          Math.min(94, playerXRef.current + moveDirRef.current * 70 * delta),
        )
        setPlayerX(playerXRef.current)
      }

      let nextBullets = bulletsRef.current
        .map((bullet) => ({ ...bullet, y: bullet.y - BULLET_SPEED * delta }))
        .filter((bullet) => bullet.y > -5)

      let nextZombies = zombiesRef.current.map((zombie) => ({
        ...zombie,
        y: zombie.y + zombie.speed * delta,
      }))

      spawnTimerRef.current -= delta
      if (spawnTimerRef.current <= 0) {
        const wave = Math.floor(scoreRef.current / 8)
        nextZombies = [...nextZombies, createZombie(wave)]
        spawnTimerRef.current = Math.max(0.45, 1.4 - wave * 0.08)
      }

      const survivingZombies = []
      let gained = 0

      nextZombies.forEach((zombie) => {
        let hp = zombie.hp
        let hitBulletId = null

        for (const bullet of nextBullets) {
          const dx = Math.abs(bullet.x - zombie.x)
          const dy = Math.abs(bullet.y - zombie.y)
          if (dx < 5.5 && dy < 6) {
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

        if (zombie.y >= 98) {
          livesRef.current -= 1
          setLives(livesRef.current)
          return
        }

        survivingZombies.push({ ...zombie, hp })
      })

      if (gained > 0) {
        scoreRef.current += gained
        setScore(scoreRef.current)
      }

      syncZombies(survivingZombies)
      syncBullets(nextBullets)

      if (livesRef.current <= 0) {
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
  }, [status, endGame, syncZombies, syncBullets])

  const handleTouchStart = (event) => {
    const touch = event.touches[0]
    if (!touch) return
    touchStartRef.current = { x: touch.clientX, moved: false }
  }

  const handleTouchMove = (event) => {
    if (!touchStartRef.current) return
    const touch = event.touches[0]
    if (!touch) return

    const stage = event.currentTarget.getBoundingClientRect()
    const relativeX = ((touch.clientX - stage.left) / stage.width) * 100
    touchStartRef.current.moved = true

    if (statusRef.current === 'ready') {
      statusRef.current = 'playing'
      setStatus('playing')
    }

    playerXRef.current = Math.max(6, Math.min(94, relativeX))
    setPlayerX(playerXRef.current)
  }

  const handleTouchEnd = () => {
    if (touchStartRef.current && !touchStartRef.current.moved) {
      if (statusRef.current === 'gameover') startGame()
      else fire()
    }
    touchStartRef.current = null
  }

  return (
    <section className="screen zombie-screen">
      <div className="zombie-shell">
        <div className="zombie-header">
          <button className="secondary-button" type="button" onClick={onBack}>
            ← Back
          </button>

          <h2>Zombie Siege</h2>

          <div className="score-pill zombie-score">Best: {best}</div>
        </div>

        <div className="zombie-hud">
          <span>Score: {score}</span>
          <span className="zombie-lives">
            {Array.from({ length: START_LIVES }, (_, index) => (
              <span
                key={index}
                className={`zombie-life ${index < lives ? 'zombie-life-on' : ''}`}
              >
                ♥
              </span>
            ))}
          </span>
        </div>

        <div
          className="zombie-stage"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          aria-label={`Zombie game. Score ${score}. Lives ${lives}.`}
        >
          <div className="zombie-fog" aria-hidden="true" />

          {zombies.map((zombie) => (
            <div
              key={zombie.id}
              className={`zombie-enemy ${zombie.hp > 1 ? 'zombie-enemy-tough' : ''}`}
              style={{ left: `${zombie.x}%`, top: `${zombie.y}%` }}
              aria-hidden="true"
            >
              <span className="zombie-head" />
              <span className="zombie-arm zombie-arm-left" />
              <span className="zombie-arm zombie-arm-right" />
            </div>
          ))}

          {bullets.map((bullet) => (
            <div
              key={bullet.id}
              className="zombie-bullet"
              style={{ left: `${bullet.x}%`, top: `${bullet.y}%` }}
              aria-hidden="true"
            />
          ))}

          <div
            className="zombie-player"
            style={{ left: `${playerX}%`, top: `${PLAYER_Y}%` }}
            aria-hidden="true"
          >
            <span className="zombie-gun" />
          </div>

          {status !== 'playing' && (
            <div className="zombie-overlay">
              <strong>{status === 'gameover' ? 'OVERRUN!' : 'SURVIVE'}</strong>
              <span>
                {status === 'gameover'
                  ? `Score ${score} · Tap to retry`
                  : 'Move + shoot the horde'}
              </span>
            </div>
          )}
        </div>

        <div className="zombie-actions">
          {status === 'gameover' ? (
            <button className="primary-button" type="button" onClick={startGame}>
              Play again
            </button>
          ) : (
            <>
              <button className="primary-button zombie-fire-button" type="button" onClick={fire}>
                Fire
              </button>
              <button className="secondary-button" type="button" onClick={resetGame}>
                Restart
              </button>
            </>
          )}
        </div>

        <div className="zombie-pad">
          <button
            type="button"
            onTouchStart={() => (moveDirRef.current = -1)}
            onTouchEnd={() => (moveDirRef.current = 0)}
            onMouseDown={() => (moveDirRef.current = -1)}
            onMouseUp={() => (moveDirRef.current = 0)}
            onMouseLeave={() => (moveDirRef.current = 0)}
            aria-label="Move left"
          >
            ←
          </button>
          <button
            type="button"
            onTouchStart={() => (moveDirRef.current = 1)}
            onTouchEnd={() => (moveDirRef.current = 0)}
            onMouseDown={() => (moveDirRef.current = 1)}
            onMouseUp={() => (moveDirRef.current = 0)}
            onMouseLeave={() => (moveDirRef.current = 0)}
            aria-label="Move right"
          >
            →
          </button>
        </div>

        <p className="zombie-help">
          <span>⌨️ ← → / A D · Space to fire</span>
          <span>📱 Drag to move · tap to fire</span>
        </p>
      </div>
    </section>
  )
}
