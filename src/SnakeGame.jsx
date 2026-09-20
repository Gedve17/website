import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './SnakeGame.css'

const BOARD_SIZE = 20
const GAME_SPEED = 120

const DIRECTIONS = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

const OPPOSITES = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
}

function createStartingSnake() {
  return [
    { x: 10, y: 10 },
    { x: 9, y: 10 },
    { x: 8, y: 10 },
  ]
}

function createFood(snake) {
  const occupied = new Set(snake.map((segment) => `${segment.x}-${segment.y}`))
  const freeCells = []

  for (let y = 0; y < BOARD_SIZE; y += 1) {
    for (let x = 0; x < BOARD_SIZE; x += 1) {
      if (!occupied.has(`${x}-${y}`)) {
        freeCells.push({ x, y })
      }
    }
  }

  if (freeCells.length === 0) return null
  return freeCells[Math.floor(Math.random() * freeCells.length)]
}

export default function SnakeGame({ onBack }) {
  const [snake, setSnake] = useState(() => createStartingSnake())
  const [food, setFood] = useState(() => createFood(createStartingSnake()))
  const [score, setScore] = useState(0)
  const [status, setStatus] = useState('ready')

  const directionRef = useRef('right')
  const nextDirectionRef = useRef('right')
  const touchStartRef = useRef(null)

  const changeDirection = useCallback((newDirection) => {
    if (!DIRECTIONS[newDirection]) return
    if (OPPOSITES[directionRef.current] === newDirection) return

    nextDirectionRef.current = newDirection
    setStatus((current) => (current === 'ready' ? 'playing' : current))
  }, [])

  const resetGame = useCallback((startImmediately = false) => {
    const newSnake = createStartingSnake()

    directionRef.current = 'right'
    nextDirectionRef.current = 'right'
    touchStartRef.current = null

    setSnake(newSnake)
    setFood(createFood(newSnake))
    setScore(0)
    setStatus(startImmediately ? 'playing' : 'ready')
  }, [])

  useEffect(() => {
    const handleKeyDown = (event) => {
      const keyMap = {
        ArrowUp: 'up',
        ArrowDown: 'down',
        ArrowLeft: 'left',
        ArrowRight: 'right',
        w: 'up',
        W: 'up',
        s: 'down',
        S: 'down',
        a: 'left',
        A: 'left',
        d: 'right',
        D: 'right',
      }

      const newDirection = keyMap[event.key]

      if (newDirection) {
        event.preventDefault()
        changeDirection(newDirection)
        return
      }

      if (event.code === 'Space') {
        event.preventDefault()
        setStatus((current) => {
          if (current === 'playing') return 'paused'
          if (current === 'paused') return 'playing'
          return current
        })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [changeDirection])

  useEffect(() => {
    if (status !== 'playing') return undefined

    const interval = window.setInterval(() => {
      const nextDirection = nextDirectionRef.current
      directionRef.current = nextDirection

      setSnake((currentSnake) => {
        const head = currentSnake[0]
        const movement = DIRECTIONS[nextDirection]
        const newHead = {
          x: head.x + movement.x,
          y: head.y + movement.y,
        }

        const hitWall =
          newHead.x < 0 ||
          newHead.x >= BOARD_SIZE ||
          newHead.y < 0 ||
          newHead.y >= BOARD_SIZE

        if (hitWall) {
          setStatus('gameover')
          return currentSnake
        }

        const ateFood = food && newHead.x === food.x && newHead.y === food.y
        const bodyToCheck = ateFood ? currentSnake : currentSnake.slice(0, -1)

        const hitSelf = bodyToCheck.some(
          (segment) => segment.x === newHead.x && segment.y === newHead.y,
        )

        if (hitSelf) {
          setStatus('gameover')
          return currentSnake
        }

        const newSnake = [newHead, ...currentSnake]

        if (ateFood) {
          setScore((currentScore) => currentScore + 1)
          const newFood = createFood(newSnake)

          if (newFood) {
            setFood(newFood)
          } else {
            setFood(null)
            setStatus('won')
          }
        } else {
          newSnake.pop()
        }

        return newSnake
      })
    }, GAME_SPEED)

    return () => window.clearInterval(interval)
  }, [food, status])

  const snakeCells = useMemo(
    () => new Set(snake.map((segment) => `${segment.x}-${segment.y}`)),
    [snake],
  )

  const handleTouchStart = (event) => {
    const touch = event.touches[0]
    if (!touch) return

    touchStartRef.current = {
      x: touch.clientX,
      y: touch.clientY,
    }
  }

  const handleTouchEnd = (event) => {
    if (!touchStartRef.current) return

    const touch = event.changedTouches[0]
    if (!touch) return

    const deltaX = touch.clientX - touchStartRef.current.x
    const deltaY = touch.clientY - touchStartRef.current.y
    touchStartRef.current = null

    const minimumSwipeDistance = 24

    if (
      Math.abs(deltaX) < minimumSwipeDistance &&
      Math.abs(deltaY) < minimumSwipeDistance
    ) {
      return
    }

    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      changeDirection(deltaX > 0 ? 'right' : 'left')
    } else {
      changeDirection(deltaY > 0 ? 'down' : 'up')
    }
  }

  const handleMainButton = () => {
    if (status === 'ready') {
      setStatus('playing')
      return
    }

    if (status === 'playing') {
      setStatus('paused')
      return
    }

    if (status === 'paused') {
      setStatus('playing')
      return
    }

    resetGame(true)
  }

  const statusText = {
    ready: 'Swipe or use the controls to start',
    playing: 'Playing',
    paused: 'Paused',
    gameover: 'Game over',
    won: 'You won!',
  }[status]

  const mainButtonText = {
    ready: 'Start',
    playing: 'Pause',
    paused: 'Resume',
    gameover: 'Play again',
    won: 'Play again',
  }[status]

  const head = snake[0]

  return (
    <section className="screen snake-screen">
      <div className="snake-shell">
        <div className="snake-header">
          <button className="secondary-button" type="button" onClick={onBack}>
            ← Back
          </button>

          <h2>Snake</h2>
          <div className="score-pill">Score: {score}</div>
        </div>

        <div className="snake-status" aria-live="polite">
          {statusText}
        </div>

        <div
          className="snake-board"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          aria-label={`Snake game. Score ${score}. ${statusText}.`}
        >
          {Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, index) => {
            const x = index % BOARD_SIZE
            const y = Math.floor(index / BOARD_SIZE)
            const isSnake = snakeCells.has(`${x}-${y}`)
            const isHead = head.x === x && head.y === y
            const isFood = food && food.x === x && food.y === y

            let className = 'snake-cell'
            if (isSnake) className += ' snake-body'
            if (isHead) className += ' snake-head'
            if (isFood) className += ' snake-food'

            return <div key={`${x}-${y}`} className={className} aria-hidden="true" />
          })}
        </div>

        <div className="snake-actions">
          <button className="primary-button" type="button" onClick={handleMainButton}>
            {mainButtonText}
          </button>

          <button className="secondary-button" type="button" onClick={() => resetGame(false)}>
            Restart
          </button>
        </div>

        <div className="snake-pad" aria-label="Snake direction controls">
          <button type="button" onClick={() => changeDirection('up')} aria-label="Move up">
            ↑
          </button>

          <div className="snake-pad-row">
            <button type="button" onClick={() => changeDirection('left')} aria-label="Move left">
              ←
            </button>
            <button type="button" onClick={() => changeDirection('down')} aria-label="Move down">
              ↓
            </button>
            <button type="button" onClick={() => changeDirection('right')} aria-label="Move right">
              →
            </button>
          </div>
        </div>

        <p className="snake-help">
          PC: Arrow keys or WASD · iPhone: swipe on the board
        </p>
      </div>
    </section>
  )
}
