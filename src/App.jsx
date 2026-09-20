import { useEffect, useMemo, useState } from 'react'

const choices = ['rock', 'paper', 'scissors']

const choiceMeta = {
  rock: { label: 'Rock', icon: '✊' },
  paper: { label: 'Paper', icon: '✋' },
  scissors: { label: 'Scissors', icon: '✌️' },
}

const calculatorButtons = [
  '7', '8', '9', '/', 'C',
  '4', '5', '6', '*', '=',
  '1', '2', '3', '+',
  '√', '0', '.', '-',
]

function formatResult(value) {
  if (!Number.isFinite(value)) return 'Error'
  if (Number.isInteger(value)) return String(value)
  return String(Number(value.toFixed(10)))
}

function tokenize(expression) {
  const compact = expression.replace(/\s+/g, '')
  if (!compact) throw new Error('Empty expression')

  const tokens = []
  let number = ''

  const pushNumber = () => {
    if (!number) return
    if (!/^-?\d*\.?\d+$/.test(number)) throw new Error('Invalid number')
    tokens.push(Number(number))
    number = ''
  }

  for (let i = 0; i < compact.length; i += 1) {
    const char = compact[i]

    if (/\d|\./.test(char)) {
      number += char
      continue
    }

    if ('+-*/'.includes(char)) {
      if (char === '-' && (i === 0 || '+-*/'.includes(compact[i - 1]))) {
        number += char
        continue
      }

      pushNumber()
      tokens.push(char)
      continue
    }

    throw new Error('Unsupported character')
  }

  pushNumber()
  return tokens
}

function evaluateExpression(expression) {
  const tokens = tokenize(expression)
  if (tokens.length === 0 || typeof tokens[0] !== 'number') {
    throw new Error('Invalid expression')
  }

  const firstPass = [tokens[0]]

  for (let i = 1; i < tokens.length; i += 2) {
    const operator = tokens[i]
    const next = tokens[i + 1]

    if (typeof next !== 'number' || !operator) throw new Error('Invalid expression')

    if (operator === '*' || operator === '/') {
      const previous = firstPass.pop()
      if (operator === '/' && next === 0) throw new Error('Division by zero')
      firstPass.push(operator === '*' ? previous * next : previous / next)
    } else {
      firstPass.push(operator, next)
    }
  }

  let result = firstPass[0]
  for (let i = 1; i < firstPass.length; i += 2) {
    const operator = firstPass[i]
    const next = firstPass[i + 1]
    result = operator === '+' ? result + next : result - next
  }

  return result
}

function WelcomeScreen({ name, setName, onSubmit, darkMode, toggleDarkMode }) {
  const handleSubmit = (event) => {
    event.preventDefault()
    onSubmit()
  }

  return (
    <section className="screen centered-screen">
      <div className="hero-card">
        <button
          className="theme-toggle"
          onClick={toggleDarkMode}
          type="button"
          aria-label="Toggle color mode"
        >
          {darkMode ? '☀️ Light mode' : '🌙 Dark mode'}
        </button>

        <p className="eyebrow">Welcome</p>
        <h1>Y9</h1>
        <p className="muted">What is your name?</p>

        <form onSubmit={handleSubmit} className="name-form">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Enter your name"
            autoFocus
            maxLength={40}
          />
          <button className="primary-button" type="submit" disabled={!name.trim()}>
            Submit
          </button>
        </form>
      </div>
    </section>
  )
}

function MenuScreen({ name, onOpenCalculator, onOpenGame, onReset }) {
  return (
    <section className="screen centered-screen">
      <div className="content-card menu-card">
        <div>
          <p className="eyebrow">Welcome</p>
          <h1>{name.toUpperCase()}</h1>
          <p className="muted">What do you want to do?</p>
        </div>

        <div className="menu-grid">
          <button className="feature-card" onClick={onOpenCalculator} type="button">
            <span className="feature-icon">🧮</span>
            <strong>Calculator</strong>
            <span>Basic arithmetic and square root</span>
          </button>

          <button className="feature-card" onClick={onOpenGame} type="button">
            <span className="feature-icon">✊</span>
            <strong>Rock Paper Scissors</strong>
            <span>Play against the computer and keep score</span>
          </button>
        </div>

        <button className="text-button" type="button" onClick={onReset}>
          Change name
        </button>
      </div>
    </section>
  )
}

function GameScreen({ onBack }) {
  const [score, setScore] = useState(0)
  const [playerChoice, setPlayerChoice] = useState(null)
  const [computerChoice, setComputerChoice] = useState(null)
  const [result, setResult] = useState('What will you choose?')

  const playRound = (player) => {
    const computer = choices[Math.floor(Math.random() * choices.length)]
    setPlayerChoice(player)
    setComputerChoice(computer)

    if (player === computer) {
      setResult('Draw!')
      return
    }

    const playerWins =
      (player === 'rock' && computer === 'scissors') ||
      (player === 'paper' && computer === 'rock') ||
      (player === 'scissors' && computer === 'paper')

    if (playerWins) {
      setResult('You won!')
      setScore((current) => current + 1)
    } else {
      setResult('You lost!')
      setScore((current) => current - 1)
    }
  }

  return (
    <section className="screen">
      <div className="top-bar">
        <button className="secondary-button" type="button" onClick={onBack}>← Back</button>
        <div className="result-pill">{result}</div>
        <div className="score-pill">Your score: {score}</div>
      </div>

      <div className="game-layout">
        <div className="choice-display">
          <p>You chose</p>
          <div className="choice-preview">
            {playerChoice ? choiceMeta[playerChoice].icon : '❔'}
          </div>
          <strong>{playerChoice ? choiceMeta[playerChoice].label : 'Choose below'}</strong>
        </div>

        <div className="versus">VS</div>

        <div className="choice-display">
          <p>PC chose</p>
          <div className="choice-preview">
            {computerChoice ? choiceMeta[computerChoice].icon : '💻'}
          </div>
          <strong>{computerChoice ? choiceMeta[computerChoice].label : 'Waiting'}</strong>
        </div>
      </div>

      <div className="choice-buttons">
        {choices.map((choice) => (
          <button key={choice} onClick={() => playRound(choice)} type="button">
            <span>{choiceMeta[choice].icon}</span>
            {choiceMeta[choice].label}
          </button>
        ))}
      </div>
    </section>
  )
}

function CalculatorScreen({ onBack }) {
  const [expression, setExpression] = useState('')
  const display = expression || '0'

  const operators = useMemo(() => new Set(['+', '-', '*', '/']), [])

  const appendValue = (value) => {
    if (value === 'C') {
      setExpression('')
      return
    }

    if (value === '=') {
      try {
        setExpression(formatResult(evaluateExpression(expression)))
      } catch {
        setExpression('Error')
      }
      return
    }

    if (value === '√') {
      try {
        const base = expression === 'Error' || expression === ''
          ? 0
          : evaluateExpression(expression)
        if (base < 0) throw new Error('Negative square root')
        setExpression(formatResult(Math.sqrt(base)))
      } catch {
        setExpression('Error')
      }
      return
    }

    setExpression((current) => {
      const safeCurrent = current === 'Error' ? '' : current
      const last = safeCurrent.at(-1)

      if (operators.has(value)) {
        if (!safeCurrent && value !== '-') return safeCurrent
        if (last && operators.has(last)) {
          if (value === '-' && last !== '-') return `${safeCurrent}${value}`
          return `${safeCurrent.slice(0, -1)}${value}`
        }
      }

      if (value === '.') {
        const currentNumber = safeCurrent.split(/[+\-*/]/).at(-1)
        if (currentNumber?.includes('.')) return safeCurrent
        if (!currentNumber) return `${safeCurrent}0.`
      }

      return `${safeCurrent}${value}`
    })
  }

  useEffect(() => {
    const handleKeyDown = (event) => {
      const keyMap = {
        '0': '0',
        '1': '1',
        '2': '2',
        '3': '3',
        '4': '4',
        '5': '5',
        '6': '6',
        '7': '7',
        '8': '8',
        '9': '9',
        '.': '.',
        ',': '.',
        '+': '+',
        '-': '-',
        '*': '*',
        '/': '/',
        '=': '=',
        'Enter': '=',
        'NumpadEnter': '=',
        'NumpadAdd': '+',
        'NumpadSubtract': '-',
        'NumpadMultiply': '*',
        'NumpadDivide': '/',
        'NumpadDecimal': '.',
        'Backspace': 'C',
        'Delete': 'C',
        'Escape': 'C',
      }

      const key = keyMap[event.key] ?? keyMap[event.code]
      if (!key) return

      event.preventDefault()
      appendValue(key)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [expression])

  return (
    <section className="screen calculator-screen">
      <div className="calculator-shell">
        <div className="calculator-header">
          <button className="secondary-button" type="button" onClick={onBack}>← Back</button>
          <h2>Calculator</h2>
        </div>

        <div className="calculator-display" aria-live="polite">{display}</div>

        <div className="calculator-grid">
          {calculatorButtons.map((button) => (
            <button
              key={button}
              type="button"
              className={button === '=' ? 'equals-button' : button === 'C' ? 'clear-button' : ''}
              onClick={() => appendValue(button)}
            >
              {button === '*' ? '×' : button === '/' ? '÷' : button}
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}

export default function App() {
  const [screen, setScreen] = useState('welcome')
  const [name, setName] = useState('')
  const [darkMode, setDarkMode] = useState(true)

  const submitName = () => {
    if (name.trim()) setScreen('menu')
  }

  const reset = () => {
    setName('')
    setScreen('welcome')
  }

  return (
    <main className={darkMode ? 'app dark' : 'app light'}>
      {screen === 'welcome' && (
        <WelcomeScreen
          name={name}
          setName={setName}
          onSubmit={submitName}
          darkMode={darkMode}
          toggleDarkMode={() => setDarkMode((current) => !current)}
        />
      )}

      {screen === 'menu' && (
        <MenuScreen
          name={name}
          onOpenCalculator={() => setScreen('calculator')}
          onOpenGame={() => setScreen('game')}
          onReset={reset}
        />
      )}

      {screen === 'game' && <GameScreen onBack={() => setScreen('menu')} />}
      {screen === 'calculator' && <CalculatorScreen onBack={() => setScreen('menu')} />}
    </main>
  )
}
