import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './TetrisGame.css'

const ROWS = 20
const COLS = 10
const START_SPEED = 650
const MIN_SPEED = 140

const SHAPES = {
  I: {
    color: 'cyan',
    matrix: [
      [1, 1, 1, 1],
    ],
  },
  O: {
    color: 'yellow',
    matrix: [
      [1, 1],
      [1, 1],
    ],
  },
  T: {
    color: 'purple',
    matrix: [
      [0, 1, 0],
      [1, 1, 1],
    ],
  },
  S: {
    color: 'green',
    matrix: [
      [0, 1, 1],
      [1, 1, 0],
    ],
  },
  Z: {
    color: 'red',
    matrix: [
      [1, 1, 0],
      [0, 1, 1],
    ],
  },
  J: {
    color: 'blue',
    matrix: [
      [1, 0, 0],
      [1, 1, 1],
    ],
  },
  L: {
    color: 'orange',
    matrix: [
      [0, 0, 1],
      [1, 1, 1],
    ],
  },
}

const PIECE_NAMES = Object.keys(SHAPES)

function createEmptyBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null))
}

function rotateMatrix(matrix) {
  return matrix[0].map((_, columnIndex) =>
    matrix.map((row) => row[columnIndex]).reverse()
  )
}

function createRandomPiece() {
  const type = PIECE_NAMES[Math.floor(Math.random() * PIECE_NAMES.length)]
  const definition = SHAPES[type]
  const matrix = definition.matrix.map((row) => [...row])

  return {
    type,
    color: definition.color,
    matrix,
    x: Math.floor((COLS - matrix[0].length) / 2),
    y: 0,
  }
}

function collides(board, piece, offsetX = 0, offsetY = 0, matrix = piece.matrix) {
  for (let row = 0; row < matrix.length; row += 1) {
    for (let col = 0; col < matrix[row].length; col += 1) {
      if (!matrix[row][col]) continue

      const boardX = piece.x + col + offsetX
      const boardY = piece.y + row + offsetY

      if (boardX < 0 || boardX >= COLS || boardY >= ROWS) {
        return true
      }

      if (boardY >= 0 && board[boardY][boardX]) {
        return true
      }
    }
  }

  return false
}

function mergePiece(board, piece) {
  const nextBoard = board.map((row) => [...row])

  piece.matrix.forEach((row, rowIndex) => {
    row.forEach((filled, colIndex) => {
      if (!filled) return

      const y = piece.y + rowIndex
      const x = piece.x + colIndex

      if (y >= 0 && y < ROWS && x >= 0 && x < COLS) {
        nextBoard[y][x] = piece.color
      }
    })
  })

  return nextBoard
}

function clearCompletedLines(board) {
  const remaining = board.filter((row) => row.some((cell) => !cell))
  const linesCleared = ROWS - remaining.length

  while (remaining.length < ROWS) {
    remaining.unshift(Array(COLS).fill(null))
  }

  return {
    board: remaining,
    linesCleared,
  }
}

function pointsForLines(lines) {
  if (lines === 1) return 100
  if (lines === 2) return 300
  if (lines === 3) return 500
  if (lines >= 4) return 800
  return 0
}

export default function TetrisGame({ onBack, onScoreSubmit }) {
  const [board, setBoard] = useState(createEmptyBoard)
  const [piece, setPiece] = useState(createRandomPiece)
  const [nextPiece, setNextPiece] = useState(createRandomPiece)
  const [score, setScore] = useState(0)
  const [lines, setLines] = useState(0)
  const [status, setStatus] = useState('ready')
  const [clearingRows, setClearingRows] = useState([])

  const boardRef = useRef(board)
  const pieceRef = useRef(piece)
  const nextPieceRef = useRef(nextPiece)
  const statusRef = useRef(status)
  const isClearingRef = useRef(false)
  const clearTimerRef = useRef(null)
  const scoreRef = useRef(0)
  const submittedRef = useRef(false)

  useEffect(() => {
    boardRef.current = board
  }, [board])

  useEffect(() => {
    pieceRef.current = piece
  }, [piece])

  useEffect(() => {
    nextPieceRef.current = nextPiece
  }, [nextPiece])

  useEffect(() => {
    statusRef.current = status
  }, [status])

  const speed = useMemo(() => {
    return Math.max(MIN_SPEED, START_SPEED - Math.floor(lines / 5) * 70)
  }, [lines])

  const startGame = useCallback(() => {
    if (statusRef.current === 'gameover') {
      const freshBoard = createEmptyBoard()
      const freshPiece = createRandomPiece()
      const freshNext = createRandomPiece()

      boardRef.current = freshBoard
      pieceRef.current = freshPiece
      nextPieceRef.current = freshNext
      statusRef.current = 'playing'

      setBoard(freshBoard)
      setPiece(freshPiece)
      setNextPiece(freshNext)
      scoreRef.current = 0
      submittedRef.current = false
      setScore(0)
      setLines(0)
      setStatus('playing')
      return
    }

    if (statusRef.current === 'ready' || statusRef.current === 'paused') {
      statusRef.current = 'playing'
      setStatus('playing')
    }
  }, [])

  const restartGame = useCallback(() => {
    const freshBoard = createEmptyBoard()
    const freshPiece = createRandomPiece()
    const freshNext = createRandomPiece()

    boardRef.current = freshBoard
    pieceRef.current = freshPiece
    nextPieceRef.current = freshNext
    statusRef.current = 'ready'
    scoreRef.current = 0
    submittedRef.current = false

    setBoard(freshBoard)
    setPiece(freshPiece)
    setNextPiece(freshNext)
    setScore(0)
    setLines(0)
    setStatus('ready')
  }, [])

  const pauseGame = useCallback(() => {
    if (statusRef.current === 'playing') {
      statusRef.current = 'paused'
      setStatus('paused')
    } else if (statusRef.current === 'paused') {
      statusRef.current = 'playing'
      setStatus('playing')
    }
  }, [])

  const spawnNextPiece = useCallback((lockedBoard) => {
    const upcoming = nextPieceRef.current
    const newNext = createRandomPiece()

    const spawned = {
      ...upcoming,
      matrix: upcoming.matrix.map((row) => [...row]),
      x: Math.floor((COLS - upcoming.matrix[0].length) / 2),
      y: 0,
    }

    if (collides(lockedBoard, spawned)) {
      statusRef.current = 'gameover'
      setStatus('gameover')
      if (!submittedRef.current) {
        submittedRef.current = true
        onScoreSubmit?.('tetris', scoreRef.current)
      }
      return
    }

    pieceRef.current = spawned
    nextPieceRef.current = newNext
    setPiece(spawned)
    setNextPiece(newNext)
  }, [onScoreSubmit])

const lockPiece = useCallback(() => {
  const currentBoard = boardRef.current
  const currentPiece = pieceRef.current

  const merged = mergePiece(currentBoard, currentPiece)

  const completedRows = merged
    .map((row, index) => (row.every(Boolean) ? index : -1))
    .filter((index) => index !== -1)

  boardRef.current = merged
  setBoard(merged)

  if (completedRows.length === 0) {
    spawnNextPiece(merged)
    return
  }

  isClearingRef.current = true
  setClearingRows(completedRows)

  clearTimerRef.current = window.setTimeout(() => {
    const cleared = clearCompletedLines(merged)

    boardRef.current = cleared.board
    setBoard(cleared.board)

    setLines(
      (currentLines) => currentLines + cleared.linesCleared
    )

    const points = pointsForLines(cleared.linesCleared)
    scoreRef.current += points
    setScore(scoreRef.current)

    setClearingRows([])
    isClearingRef.current = false
    clearTimerRef.current = null

    spawnNextPiece(cleared.board)
  }, 260)
}, [spawnNextPiece])

  const moveHorizontal = useCallback((direction) => {
    if (isClearingRef.current) return
    if (statusRef.current === 'ready') {
      startGame()
      return
    }

    if (statusRef.current !== 'playing') return

    const currentBoard = boardRef.current
    const currentPiece = pieceRef.current

    if (!collides(currentBoard, currentPiece, direction, 0)) {
      const next = {
        ...currentPiece,
        x: currentPiece.x + direction,
      }

      pieceRef.current = next
      setPiece(next)
    }
  }, [startGame])

  const rotatePiece = useCallback(() => {
    if (isClearingRef.current) return
    if (statusRef.current === 'ready') {
      startGame()
      return
    }

    if (statusRef.current !== 'playing') return

    const currentBoard = boardRef.current
    const currentPiece = pieceRef.current
    const rotated = rotateMatrix(currentPiece.matrix)

    if (!collides(currentBoard, currentPiece, 0, 0, rotated)) {
      const next = {
        ...currentPiece,
        matrix: rotated,
      }

      pieceRef.current = next
      setPiece(next)
      return
    }

    const wallKicks = [-1, 1, -2, 2]

    for (const offset of wallKicks) {
      if (!collides(currentBoard, currentPiece, offset, 0, rotated)) {
        const next = {
          ...currentPiece,
          x: currentPiece.x + offset,
          matrix: rotated,
        }

        pieceRef.current = next
        setPiece(next)
        return
      }
    }
  }, [startGame])

  const dropOne = useCallback(() => {
    if (isClearingRef.current) return
    if (statusRef.current === 'ready') {
      startGame()
      return
    }

    if (statusRef.current !== 'playing') return

    const currentBoard = boardRef.current
    const currentPiece = pieceRef.current

    if (!collides(currentBoard, currentPiece, 0, 1)) {
      const next = {
        ...currentPiece,
        y: currentPiece.y + 1,
      }

      pieceRef.current = next
      setPiece(next)
    } else {
      lockPiece()
    }
  }, [lockPiece, startGame])

  const hardDrop = useCallback(() => {
    if (isClearingRef.current) return
    if (statusRef.current === 'ready') {
      startGame()
      return
    }

    if (statusRef.current !== 'playing') return

    const currentBoard = boardRef.current
    const currentPiece = pieceRef.current

    let distance = 0

    while (!collides(currentBoard, currentPiece, 0, distance + 1)) {
      distance += 1
    }

    const dropped = {
      ...currentPiece,
      y: currentPiece.y + distance,
    }

    pieceRef.current = dropped
    setPiece(dropped)
    scoreRef.current += distance * 2
    setScore(scoreRef.current)

    requestAnimationFrame(() => {
      lockPiece()
    })
  }, [lockPiece, startGame])

  useEffect(() => {
    if (status !== 'playing') return undefined

    const timer = window.setInterval(() => {
      dropOne()
    }, speed)

    return () => window.clearInterval(timer)
  }, [status, speed, dropOne])

  useEffect(() => {
    const handleKeyDown = (event) => {
      const target = event.target
      const isEditable =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable

      if (isEditable) return

      if (event.key === 'ArrowLeft' || event.key === 'a' || event.key === 'A') {
        event.preventDefault()
        moveHorizontal(-1)
        return
      }

      if (event.key === 'ArrowRight' || event.key === 'd' || event.key === 'D') {
        event.preventDefault()
        moveHorizontal(1)
        return
      }

      if (event.key === 'ArrowDown' || event.key === 's' || event.key === 'S') {
        event.preventDefault()
        dropOne()
        return
      }

      if (event.key === 'ArrowUp' || event.key === 'w' || event.key === 'W') {
        event.preventDefault()
        rotatePiece()
        return
      }

      if (event.code === 'Space') {
        event.preventDefault()
        hardDrop()
        return
      }

      if (event.key === 'p' || event.key === 'P') {
        event.preventDefault()
        pauseGame()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [moveHorizontal, dropOne, rotatePiece, hardDrop, pauseGame])

  const renderedBoard = useMemo(() => {
    const display = board.map((row) => [...row])

    piece.matrix.forEach((row, rowIndex) => {
      row.forEach((filled, colIndex) => {
        if (!filled) return

        const y = piece.y + rowIndex
        const x = piece.x + colIndex

        if (y >= 0 && y < ROWS && x >= 0 && x < COLS) {
          display[y][x] = piece.color
        }
      })
    })

    return display
  }, [board, piece])

  const statusText = {
    ready: 'Ready',
    playing: 'Playing',
    paused: 'Paused',
    gameover: 'Game Over',
  }[status]

  return (
    <section className="screen tetris-screen">
      <div className="tetris-shell">
        <div className="tetris-header">
          <button className="secondary-button" type="button" onClick={onBack}>
            ← Back
          </button>

          <h2>Tetris</h2>

          <div className="tetris-score">
            Score: {score}
          </div>
        </div>

        <div className="tetris-layout">
          <div className="tetris-main">
            <div className="tetris-status" aria-live="polite">
              {statusText}
            </div>

            <div className="tetris-board" aria-label={`Tetris board. Score ${score}.`}>
              {renderedBoard.flatMap((row, rowIndex) =>
                row.map((cell, colIndex) => (
                  <div
                    key={`${rowIndex}-${colIndex}`}
                    className={`tetris-cell${cell ? ` tetris-${cell}` : ''}${
                      clearingRows.includes(rowIndex)
                        ? ' tetris-clearing'
                        : ''
                    }`}
                    aria-hidden="true"
                  />
                ))
              )}

              {status !== 'playing' && (
                <div className="tetris-overlay">
                  <strong>
                    {status === 'gameover'
                      ? 'GAME OVER'
                      : status === 'paused'
                        ? 'PAUSED'
                        : 'TETRIS'}
                  </strong>

                  <span>
                    {status === 'gameover'
                      ? 'Press Start to play again'
                      : status === 'paused'
                        ? 'Press Resume'
                        : 'Press Start'}
                  </span>
                </div>
              )}
            </div>
          </div>

          <aside className="tetris-sidebar">
            <div className="tetris-info-card">
              <span>Lines</span>
              <strong>{lines}</strong>
            </div>

            <div className="tetris-info-card">
              <span>Level</span>
              <strong>{Math.floor(lines / 5) + 1}</strong>
            </div>

            <div className="tetris-next-card">
              <span>Next</span>

              <div
                className="tetris-next-grid"
                style={{
                  '--next-columns': nextPiece.matrix[0].length,
                }}
              >
                {nextPiece.matrix.flatMap((row, rowIndex) =>
                  row.map((filled, colIndex) => (
                    <div
                      key={`${rowIndex}-${colIndex}`}
                      className={`tetris-next-cell${
                        filled ? ` tetris-${nextPiece.color}` : ''
                      }`}
                    />
                  ))
                )}
              </div>
            </div>
          </aside>
        </div>

        <div className="tetris-actions">
          <button
            className="primary-button"
            type="button"
            onClick={
              status === 'playing'
                ? pauseGame
                : status === 'paused'
                  ? pauseGame
                  : startGame
            }
          >
            {status === 'playing'
              ? 'Pause'
              : status === 'paused'
                ? 'Resume'
                : status === 'gameover'
                  ? 'Play again'
                  : 'Start'}
          </button>

          <button
            className="secondary-button"
            type="button"
            onClick={restartGame}
          >
            Restart
          </button>
        </div>

        <div className="tetris-controls">
          <button type="button" onClick={() => moveHorizontal(-1)} aria-label="Move left">
            ←
          </button>

          <button type="button" onClick={rotatePiece} aria-label="Rotate">
            ↻
          </button>

          <button type="button" onClick={() => moveHorizontal(1)} aria-label="Move right">
            →
          </button>

          <button type="button" onClick={dropOne} aria-label="Move down">
            ↓
          </button>

          <button
            type="button"
            className="tetris-drop-button"
            onClick={hardDrop}
            aria-label="Hard drop"
          >
            ⇊
          </button>
        </div>

        <p className="tetris-help">
          PC: ← → move · ↑ rotate · ↓ soft drop · Space hard drop · P pause
        </p>
      </div>
    </section>
  )
}
