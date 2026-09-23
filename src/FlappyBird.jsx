import { useCallback, useEffect, useRef, useState } from 'react'
import './FlappyBird.css'

const GAME_WIDTH = 360
const GAME_HEIGHT = 520
const BIRD_X = 74
const BIRD_SIZE = 34
const PIPE_WIDTH = 58
const PIPE_GAP = 150
const PIPE_SPEED = 2.8
const GRAVITY = 0.42
const FLAP_POWER = -7.2
const PIPE_SPACING = 220

function createPipe(x) {
  const minTop = 70
  const maxTop = GAME_HEIGHT - PIPE_GAP - 110
  const gapTop = Math.floor(
    minTop + Math.random() * Math.max(1, maxTop - minTop)
  )

  return { x, gapTop, passed: false }
}

function createInitialPipes() {
  return [
    createPipe(GAME_WIDTH + 80),
    createPipe(GAME_WIDTH + 80 + PIPE_SPACING),
  ]
}

export default function FlappyBird({ onBack, onScoreSubmit }) {
  const [birdY, setBirdY] = useState(GAME_HEIGHT / 2)
  const [pipes, setPipes] = useState(createInitialPipes)
  const [score, setScore] = useState(0)
  const [bestScore, setBestScore] = useState(0)
  const [status, setStatus] = useState('ready')

  const birdYRef = useRef(GAME_HEIGHT / 2)
  const velocityRef = useRef(0)
  const pipesRef = useRef(createInitialPipes())
  const statusRef = useRef('ready')
  const animationFrameRef = useRef(null)
  const lastTimeRef = useRef(null)
  const submittedRef = useRef(false)

  const syncPipes = useCallback((nextPipes) => {
    pipesRef.current = nextPipes
    setPipes(nextPipes)
  }, [])

  const resetGame = useCallback(() => {
    const startY = GAME_HEIGHT / 2
    const newPipes = createInitialPipes()

    birdYRef.current = startY
    velocityRef.current = 0
    statusRef.current = 'ready'
    submittedRef.current = false
    lastTimeRef.current = null

    setBirdY(startY)
    syncPipes(newPipes)
    setScore(0)
    setStatus('ready')
  }, [syncPipes])

  const endGame = useCallback(() => {
    statusRef.current = 'gameover'
    setStatus('gameover')
    setBestScore((currentBest) => Math.max(currentBest, score))
    if (!submittedRef.current) {
      submittedRef.current = true
      onScoreSubmit?.('flappy', score)
    }
  }, [onScoreSubmit, score])

  const flap = useCallback(() => {
    if (statusRef.current === 'gameover') {
      const startY = GAME_HEIGHT / 2
      const newPipes = createInitialPipes()

      birdYRef.current = startY
      velocityRef.current = FLAP_POWER
      statusRef.current = 'playing'
      lastTimeRef.current = null

      setBirdY(startY)
      syncPipes(newPipes)
      setScore(0)
      setStatus('playing')
      return
    }

    if (statusRef.current === 'ready') {
      statusRef.current = 'playing'
      setStatus('playing')
    }

    if (statusRef.current === 'playing') {
      velocityRef.current = FLAP_POWER
    }
  }, [syncPipes])

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (
        event.code === 'Space' ||
        event.code === 'ArrowUp' ||
        event.key === 'w' ||
        event.key === 'W'
      ) {
        event.preventDefault()
        flap()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [flap])

  useEffect(() => {
    if (status !== 'playing') return undefined

    const tick = (time) => {
      if (statusRef.current !== 'playing') return

      if (lastTimeRef.current == null) {
        lastTimeRef.current = time
      }

      const delta = Math.min((time - lastTimeRef.current) / 16.67, 2)
      lastTimeRef.current = time

      velocityRef.current += GRAVITY * delta
      const nextBirdY = birdYRef.current + velocityRef.current * delta

      birdYRef.current = nextBirdY
      setBirdY(nextBirdY)

      let nextPipes = pipesRef.current.map((pipe) => ({
        ...pipe,
        x: pipe.x - PIPE_SPEED * delta,
      }))

      const rightmostPipe = Math.max(...nextPipes.map((pipe) => pipe.x))

      nextPipes = nextPipes.map((pipe) => {
        if (pipe.x + PIPE_WIDTH < -5) {
          return createPipe(rightmostPipe + PIPE_SPACING)
        }
        return pipe
      })

      let scored = false

      nextPipes = nextPipes.map((pipe) => {
        if (!pipe.passed && pipe.x + PIPE_WIDTH < BIRD_X) {
          scored = true
          return { ...pipe, passed: true }
        }
        return pipe
      })

      if (scored) {
        setScore((currentScore) => {
          const nextScore = currentScore + 1
          setBestScore((currentBest) => Math.max(currentBest, nextScore))
          return nextScore
        })
      }

      syncPipes(nextPipes)

      const birdLeft = BIRD_X
      const birdRight = BIRD_X + BIRD_SIZE
      const birdTop = nextBirdY
      const birdBottom = nextBirdY + BIRD_SIZE

      const hitCeiling = birdTop <= 0
      const hitGround = birdBottom >= GAME_HEIGHT

      const hitPipe = nextPipes.some((pipe) => {
        const pipeLeft = pipe.x
        const pipeRight = pipe.x + PIPE_WIDTH
        const overlapsHorizontally =
          birdRight > pipeLeft && birdLeft < pipeRight

        if (!overlapsHorizontally) return false

        const gapBottom = pipe.gapTop + PIPE_GAP
        return birdTop < pipe.gapTop || birdBottom > gapBottom
      })

      if (hitCeiling || hitGround || hitPipe) {
        endGame()
        return
      }

      animationFrameRef.current = requestAnimationFrame(tick)
    }

    animationFrameRef.current = requestAnimationFrame(tick)

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      animationFrameRef.current = null
      lastTimeRef.current = null
    }
  }, [status, endGame, syncPipes])

  const birdRotation =
    status === 'playing'
      ? Math.max(-25, Math.min(80, velocityRef.current * 6))
      : 0

  const statusMessage = {
    ready: 'Tap to start',
    playing: '',
    gameover: 'Game over',
  }[status]

  return (
    <section className="screen flappy-screen">
      <div className="flappy-shell">
        <div className="flappy-header">
          <button className="secondary-button" type="button" onClick={onBack}>
            ← Back
          </button>

          <h2>Flappy Bird</h2>

          <div className="flappy-best">Best: {bestScore}</div>
        </div>

        <button
          type="button"
          className="flappy-stage"
          onClick={flap}
          aria-label="Flappy Bird game. Tap to flap."
        >
          <div className="flappy-cloud cloud-one" />
          <div className="flappy-cloud cloud-two" />
          <div className="flappy-score">{score}</div>

          {pipes.map((pipe, index) => (
            <div key={index} className="flappy-pipe-pair" aria-hidden="true">
              <div
                className="flappy-pipe flappy-pipe-top"
                style={{
                  left: `${(pipe.x / GAME_WIDTH) * 100}%`,
                  height: `${(pipe.gapTop / GAME_HEIGHT) * 100}%`,
                  width: `${(PIPE_WIDTH / GAME_WIDTH) * 100}%`,
                }}
              />

              <div
                className="flappy-pipe flappy-pipe-bottom"
                style={{
                  left: `${(pipe.x / GAME_WIDTH) * 100}%`,
                  top: `${((pipe.gapTop + PIPE_GAP) / GAME_HEIGHT) * 100}%`,
                  width: `${(PIPE_WIDTH / GAME_WIDTH) * 100}%`,
                  height: `${
                    ((GAME_HEIGHT - pipe.gapTop - PIPE_GAP) / GAME_HEIGHT) * 100
                  }%`,
                }}
              />
            </div>
          ))}

          <div
            className="flappy-bird"
            style={{
              left: `${(BIRD_X / GAME_WIDTH) * 100}%`,
              top: `${(birdY / GAME_HEIGHT) * 100}%`,
              width: `${(BIRD_SIZE / GAME_WIDTH) * 100}%`,
              aspectRatio: '1',
              transform: `rotate(${birdRotation}deg)`,
            }}
            aria-hidden="true"
          >
            <span className="flappy-wing" />
            <span className="flappy-eye" />
            <span className="flappy-beak" />
          </div>

          {status !== 'playing' && (
            <div className="flappy-overlay">
              <strong>{statusMessage}</strong>
              <span>
                {status === 'gameover'
                  ? 'Tap to play again'
                  : 'Tap, Space, ↑ or W'}
              </span>
            </div>
          )}

          <div className="flappy-ground" aria-hidden="true" />
        </button>

        <div className="flappy-actions">
          <button className="secondary-button" type="button" onClick={resetGame}>
            Restart
          </button>
        </div>

        <p className="flappy-help">
          iPhone: tap the game area · PC: Space, ↑ or W
        </p>
      </div>
    </section>
  )
}
