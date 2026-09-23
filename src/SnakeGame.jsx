import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './SnakeGame.css'

const BOARD_SIZE = 20
const GAME_SPEED = 120
const BONUS_LIFETIME_TICKS = 50
const BONUS_MOVE_EVERY_TICKS = 3
const BONUS_SPAWN_CHANCE = 0.18

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

function createBonusFruit(snake, food) {
  if (Math.random() > BONUS_SPAWN_CHANCE) return null

  const occupied = new Set(snake.map((segment) => `${segment.x}-${segment.y}`))
  if (food) occupied.add(`${food.x}-${food.y}`)

  const freeCells = []
  for (let y = 0; y < BOARD_SIZE; y += 1) {
    for (let x = 0; x < BOARD_SIZE; x += 1) {
      if (!occupied.has(`${x}-${y}`)) freeCells.push({ x, y })
    }
  }

  if (freeCells.length === 0) return null
  return { ...freeCells[Math.floor(Math.random() * freeCells.length)], ttl: BONUS_LIFETIME_TICKS }
}

function moveBonusFruit(bonus, snake, food) {
  const candidates = Object.values(DIRECTIONS)
    .map((direction) => ({ x: bonus.x + direction.x, y: bonus.y + direction.y }))
    .filter((cell) => (
      cell.x >= 0 &&
      cell.x < BOARD_SIZE &&
      cell.y >= 0 &&
      cell.y < BOARD_SIZE &&
      !snake.some((segment) => segment.x === cell.x && segment.y === cell.y) &&
      (!food || food.x !== cell.x || food.y !== cell.y)
    ))

  if (candidates.length === 0) return { ...bonus, ttl: bonus.ttl - 1 }
  const next = candidates[Math.floor(Math.random() * candidates.length)]
  return { ...next, ttl: bonus.ttl - 1 }
}

export default function SnakeGame({ onBack, onScoreSubmit }) {
  const [snake, setSnake] = useState(() => createStartingSnake())
  const [food, setFood] = useState(() => createFood(createStartingSnake()))
  const [bonusFood, setBonusFood] = useState(() => {
    const snake = createStartingSnake()
    return createBonusFruit(snake, food)
  })
  const [score, setScore] = useState(0)
  const [status, setStatus] = useState('ready')

  const directionRef = useRef('right')
  const directionQueueRef = useRef([])
  const touchStartRef = useRef(null)
  const bonusFoodRef = useRef(bonusFood)
  const snakeRef = useRef(snake)
  const bonusTickRef = useRef(0)
  const scoreRef = useRef(0)
  const submittedRef = useRef(false)

  const changeDirection = useCallback((newDirection) => {
    if (!DIRECTIONS[newDirection]) return
    const lastQueuedDirection = directionQueueRef.current.at(-1) || directionRef.current
    if (OPPOSITES[lastQueuedDirection] === newDirection) return

    if (directionQueueRef.current.length < 2) directionQueueRef.current.push(newDirection)
    setStatus((current) => (current === 'ready' ? 'playing' : current))
  }, [])

  const resetGame = useCallback((startImmediately = false) => {
    const newSnake = createStartingSnake()

    directionRef.current = 'right'
    directionQueueRef.current = []
    touchStartRef.current = null
    scoreRef.current = 0
    submittedRef.current = false
    bonusTickRef.current = 0
    snakeRef.current = newSnake

    setSnake(newSnake)
    const newFood = createFood(newSnake)
    const newBonusFood = createBonusFruit(newSnake, newFood)
    bonusFoodRef.current = newBonusFood
    setFood(newFood)
    setBonusFood(newBonusFood)
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
      const nextDirection = directionQueueRef.current.shift() || directionRef.current
      directionRef.current = nextDirection

      bonusTickRef.current += 1
      let nextBonusFood = bonusFoodRef.current
      if (nextBonusFood) {
        nextBonusFood = nextBonusFood.ttl <= 0
          ? null
          : bonusTickRef.current % BONUS_MOVE_EVERY_TICKS === 0
            ? moveBonusFruit(nextBonusFood, snakeRef.current, food)
            : { ...nextBonusFood, ttl: nextBonusFood.ttl - 1 }
        bonusFoodRef.current = nextBonusFood
        setBonusFood(nextBonusFood)
      }

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
          if (!submittedRef.current) {
            submittedRef.current = true
            onScoreSubmit?.('snake', scoreRef.current)
          }
          return currentSnake
        }

        const ateFood = food && newHead.x === food.x && newHead.y === food.y
        const ateBonusFood = nextBonusFood && newHead.x === nextBonusFood.x && newHead.y === nextBonusFood.y
        const bodyToCheck = ateFood || ateBonusFood ? currentSnake : currentSnake.slice(0, -1)

        const hitSelf = bodyToCheck.some(
          (segment) => segment.x === newHead.x && segment.y === newHead.y,
        )

        if (hitSelf) {
          setStatus('gameover')
          if (!submittedRef.current) {
            submittedRef.current = true
            onScoreSubmit?.('snake', scoreRef.current)
          }
          return currentSnake
        }

        const newSnake = [newHead, ...currentSnake]

        if (ateFood || ateBonusFood) {
          scoreRef.current += ateBonusFood ? 5 : 1
          setScore(scoreRef.current)
          const newFood = ateFood ? createFood(newSnake) : food

          if (ateFood && newFood) {
            setFood(newFood)
          } else if (ateFood) {
            setFood(null)
            setStatus('won')
          }

          if (ateBonusFood) {
            const refreshedBonus = createBonusFruit(newSnake, newFood)
            bonusFoodRef.current = refreshedBonus
            setBonusFood(refreshedBonus)
          }
        } else {
          newSnake.pop()
        }

        snakeRef.current = newSnake

        return newSnake
      })
    }, GAME_SPEED)

    return () => window.clearInterval(interval)
  }, [food, status])

  const snakeIndexByCell = useMemo(
    () => new Map(snake.map((segment, index) => [`${segment.x}-${segment.y}`, index])),
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

  const overlayText = {
    ready: 'READY?',
    paused: 'PAUSED',
    gameover: 'GAME OVER',
    won: 'YOU WIN!',
  }[status]

  return (
    <section className="screen snake-screen">
      <div className="snake-shell">
        <div className="snake-header">
          <button className="secondary-button" type="button" onClick={onBack}>
            ← Back
          </button>

          <h2>Snake</h2>
          <div className="score-pill snake-score">Score: {score}</div>
        </div>

        <div className="snake-status" aria-live="polite">
          <span className={`snake-status-dot snake-status-dot-${status}`} />
          {statusText}
        </div>

        <div className="snake-board-frame">
          <div
            className={`snake-board snake-board-${status}`}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            aria-label={`Snake game. Score ${score}. ${statusText}.`}
          >
            {Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, index) => {
              const x = index % BOARD_SIZE
              const y = Math.floor(index / BOARD_SIZE)
              const snakeIndex = snakeIndexByCell.get(`${x}-${y}`)
              const isSnake = snakeIndex !== undefined
              const isHead = snakeIndex === 0
              const isTail = snakeIndex === snake.length - 1
              const isFood = food && food.x === x && food.y === y
              const isBonusFood = bonusFood && bonusFood.x === x && bonusFood.y === y

              let className = 'snake-cell'
              if (isSnake) className += ' snake-body'
              if (isHead) className += ` snake-head snake-head-${directionRef.current}`
              if (isTail) className += ' snake-tail'
              if (isFood) className += ' snake-food'
              if (isBonusFood) className += ' snake-bonus-food'

              return <div key={`${x}-${y}`} className={className} aria-hidden="true" />
            })}
          </div>

          {status !== 'playing' && (
            <div className={`snake-overlay snake-overlay-${status}`} aria-hidden="true">
              <span>{overlayText}</span>
              {status === 'gameover' && <small>Score {score}</small>}
            </div>
          )}
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
          <span>⌨️ Arrow keys / WASD</span>
          <span>📱 Swipe on the board</span>
        </p>
      </div>
    </section>
  )
}
