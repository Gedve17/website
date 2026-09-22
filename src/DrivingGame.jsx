import { useCallback, useEffect, useRef, useState } from 'react'
import './DrivingGame.css'

const LANES = [18, 50, 82]
const PLAYER_Y = 82
const START_SPEED = 34
const MAX_SPEED = 78

function randomLane(excludeLane) {
  const options = [0, 1, 2].filter((lane) => lane !== excludeLane)
  return options[Math.floor(Math.random() * options.length)]
}

function createCar(lane, y = -18) {
  return {
    id: Math.random().toString(36).slice(2),
    lane,
    y,
    kind: Math.random() < 0.25 ? 'truck' : 'car',
    passed: false,
  }
}

export default function DrivingGame({ onBack }) {
  const [playerLane, setPlayerLane] = useState(1)
  const [cars, setCars] = useState([])
  const [score, setScore] = useState(0)
  const [best, setBest] = useState(0)
  const [status, setStatus] = useState('ready')

  const playerLaneRef = useRef(1)
  const carsRef = useRef([])
  const statusRef = useRef('ready')
  const scoreRef = useRef(0)
  const speedRef = useRef(START_SPEED)
  const spawnTimerRef = useRef(0)
  const lastTimeRef = useRef(null)
  const animationFrameRef = useRef(null)
  const touchStartRef = useRef(null)

  const syncCars = useCallback((next) => {
    carsRef.current = next
    setCars(next)
  }, [])

  const resetGame = useCallback(() => {
    playerLaneRef.current = 1
    carsRef.current = []
    statusRef.current = 'ready'
    scoreRef.current = 0
    speedRef.current = START_SPEED
    spawnTimerRef.current = 0
    lastTimeRef.current = null

    setPlayerLane(1)
    setCars([])
    setScore(0)
    setStatus('ready')
  }, [])

  const startGame = useCallback(() => {
    resetGame()
    statusRef.current = 'playing'
    setStatus('playing')
  }, [resetGame])

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

  const endGame = useCallback(() => {
    statusRef.current = 'gameover'
    setStatus('gameover')
    setBest((currentBest) => Math.max(currentBest, scoreRef.current))
  }, [])

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'ArrowLeft' || event.key === 'a' || event.key === 'A') {
        event.preventDefault()
        moveLane(-1)
      } else if (event.key === 'ArrowRight' || event.key === 'd' || event.key === 'D') {
        event.preventDefault()
        moveLane(1)
      } else if (event.code === 'Space' && statusRef.current === 'gameover') {
        event.preventDefault()
        startGame()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [moveLane, startGame])

  useEffect(() => {
    if (status !== 'playing') return undefined

    const tick = (time) => {
      if (statusRef.current !== 'playing') return

      if (lastTimeRef.current == null) lastTimeRef.current = time
      const delta = Math.min((time - lastTimeRef.current) / 1000, 0.05)
      lastTimeRef.current = time

      speedRef.current = Math.min(MAX_SPEED, speedRef.current + delta * 0.6)

      scoreRef.current += delta * speedRef.current * 0.4
      setScore(Math.floor(scoreRef.current))

      spawnTimerRef.current -= delta
      let nextCars = carsRef.current.map((car) => ({
        ...car,
        y: car.y + speedRef.current * delta * 0.6,
      }))

      if (spawnTimerRef.current <= 0) {
        const lane = randomLane()
        nextCars = [...nextCars, createCar(lane)]
        spawnTimerRef.current = Math.max(0.55, 1.5 - scoreRef.current / 900)
      }

      nextCars = nextCars.filter((car) => car.y < 118)

      const collided = nextCars.some(
        (car) =>
          car.lane === playerLaneRef.current &&
          car.y > PLAYER_Y - 13 &&
          car.y < PLAYER_Y + 13,
      )

      syncCars(nextCars)

      if (collided) {
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
  }, [status, endGame, syncCars])

  const handleTouchStart = (event) => {
    const touch = event.touches[0]
    if (!touch) return
    touchStartRef.current = touch.clientX
  }

  const handleTouchEnd = (event) => {
    if (touchStartRef.current == null) return
    const touch = event.changedTouches[0]
    if (!touch) return

    const deltaX = touch.clientX - touchStartRef.current
    touchStartRef.current = null

    if (Math.abs(deltaX) < 28) {
      if (statusRef.current === 'gameover') startGame()
      return
    }

    moveLane(deltaX > 0 ? 1 : -1)
  }

  const statusMessage = {
    ready: 'Tap or press ← → to start',
    playing: '',
    gameover: 'You crashed!',
  }[status]

  return (
    <section className="screen driving-screen">
      <div className="driving-shell">
        <div className="driving-header">
          <button className="secondary-button" type="button" onClick={onBack}>
            ← Back
          </button>

          <h2>Highway Dash</h2>

          <div className="score-pill driving-score">Best: {best}</div>
        </div>

        <div
          className="driving-stage"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          aria-label={`Driving game. Score ${score}.`}
        >
          <div className="driving-score-display">{score}</div>

          <div className="driving-lane-line driving-lane-line-1" aria-hidden="true" />
          <div className="driving-lane-line driving-lane-line-2" aria-hidden="true" />

          {cars.map((car) => (
            <div
              key={car.id}
              className={`driving-car driving-car-${car.kind}`}
              style={{
                left: `${LANES[car.lane]}%`,
                top: `${car.y}%`,
              }}
              aria-hidden="true"
            >
              <span className="driving-windshield" />
            </div>
          ))}

          <div
            className="driving-player"
            style={{ left: `${LANES[playerLane]}%`, top: `${PLAYER_Y}%` }}
            aria-hidden="true"
          >
            <span className="driving-windshield" />
            <span className="driving-headlight driving-headlight-left" />
            <span className="driving-headlight driving-headlight-right" />
          </div>

          {status !== 'playing' && (
            <div className="driving-overlay">
              <strong>{status === 'gameover' ? 'CRASH!' : 'READY?'}</strong>
              <span>{status === 'gameover' ? `Score ${score}` : statusMessage}</span>
            </div>
          )}
        </div>

        <div className="driving-actions">
          {status === 'gameover' ? (
            <button className="primary-button" type="button" onClick={startGame}>
              Play again
            </button>
          ) : (
            <button className="secondary-button" type="button" onClick={resetGame}>
              Restart
            </button>
          )}
        </div>

        <div className="driving-pad">
          <button type="button" onClick={() => moveLane(-1)} aria-label="Move left">
            ←
          </button>
          <button type="button" onClick={() => moveLane(1)} aria-label="Move right">
            →
          </button>
        </div>

        <p className="driving-help">
          <span>⌨️ ← → / A D</span>
          <span>📱 Swipe left or right</span>
        </p>
      </div>
    </section>
  )
}
