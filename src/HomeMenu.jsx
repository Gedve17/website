import { useEffect, useState } from 'react'
import { LeaderboardPanel } from './Leaderboard'
import { leaderboardGames } from './leaderboardApi'
import './HomeMenu.css'

const featuredGames = [
  {
    id: 'driving',
    icon: '🏎️',
    title: 'Highway Escape',
    description: 'Mouse-controlled highway survival. Dodge traffic and chase a new record.',
    controls: 'Mouse + touch',
    className: 'home-featured-driving',
  },
  {
    id: 'zombie',
    icon: '🧟',
    title: 'Zombie Outbreak',
    description: 'Survive the horde, aim with your mouse and fight through harder waves.',
    controls: 'WASD + mouse',
    className: 'home-featured-zombie',
  },
  {
    id: 'helicopter',
    icon: '🚁',
    title: 'Helicopter Assault',
    description: 'Fly combat missions, destroy enemy targets and protect the convoy.',
    controls: 'WASD + mouse',
    className: 'home-featured-helicopter',
  },
]

const classicGames = [
  { id: 'snake', icon: '🐍', title: 'Snake' },
  { id: 'flappy', icon: '🐦', title: 'Flappy Bird' },
  { id: 'tetris', icon: '🧱', title: 'Tetris' },
  { id: 'blackjack', icon: '🃏', title: 'Blackjack' },
  { id: 'rps', icon: '✊', title: 'Rock Paper Scissors' },
]

export default function HomeMenu({
  name,
  darkMode,
  toggleDarkMode,
  onOpenLeaderboard,
  onOpenCalculator,
  onOpenGame,
  onOpenSnake,
  onOpenFlappy,
  onOpenTetris,
  onOpenBlackjack,
  onOpenDriving,
  onOpenZombie,
  onOpenHelicopter,
  onReset,
}) {
  const [mobileLeaderboardsOpen, setMobileLeaderboardsOpen] = useState(false)

  const openGame = {
    driving: onOpenDriving,
    zombie: onOpenZombie,
    helicopter: onOpenHelicopter,
    snake: onOpenSnake,
    flappy: onOpenFlappy,
    tetris: onOpenTetris,
    blackjack: onOpenBlackjack,
    rps: onOpenGame,
  }

  useEffect(() => {
    if (!mobileLeaderboardsOpen) return undefined

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setMobileLeaderboardsOpen(false)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [mobileLeaderboardsOpen])

  return (
    <section className="screen arcade-home-screen">
      <header className="arcade-home-header">
        <div className="arcade-brand">
          <span className="arcade-brand-mark">Y9</span>
          <div>
            <p className="eyebrow">Arcade</p>
            <p className="arcade-welcome">
              Welcome, <strong>{name}</strong>
            </p>
          </div>
        </div>

        <div className="arcade-header-actions">
          <button className="arcade-header-button" type="button" onClick={onOpenLeaderboard}>
            🏆 Leaderboards
          </button>
          <button className="arcade-header-button" type="button" onClick={toggleDarkMode}>
            {darkMode ? '☀️ Light' : '🌙 Dark'}
          </button>
        </div>
      </header>

      <div className="arcade-home-layout">
        <main className="arcade-home-main">
          <section className="arcade-section">
            <div className="arcade-section-heading">
              <div>
                <p className="eyebrow">Featured</p>
                <h1>Pick a game</h1>
              </div>
            </div>

            <div className="featured-game-grid">
              {featuredGames.map((game) => (
                <button
                  className={`featured-game-card ${game.className}`}
                  key={game.id}
                  type="button"
                  onClick={openGame[game.id]}
                >
                  <div className="featured-game-topline">
                    <span className="featured-game-icon" aria-hidden="true">{game.icon}</span>
                    <span className="featured-game-control">{game.controls}</span>
                  </div>

                  <div className="featured-game-copy">
                    <strong>{game.title}</strong>
                    <span>{game.description}</span>
                  </div>

                  <span className="featured-game-play">Play →</span>
                </button>
              ))}
            </div>
          </section>

          <section className="arcade-section">
            <div className="arcade-section-heading arcade-section-heading-small">
              <div>
                <p className="eyebrow">Classics</p>
                <h2>Quick games</h2>
              </div>
            </div>

            <div className="classic-game-grid">
              {classicGames.map((game) => (
                <button
                  className="classic-game-card"
                  key={game.id}
                  type="button"
                  onClick={openGame[game.id]}
                >
                  <span className="classic-game-icon" aria-hidden="true">{game.icon}</span>
                  <strong>{game.title}</strong>
                  <span>Play →</span>
                </button>
              ))}
            </div>
          </section>

          <section className="arcade-section arcade-utility-section">
            <div className="arcade-section-heading arcade-section-heading-small">
              <div>
                <p className="eyebrow">Utilities</p>
                <h2>Tools</h2>
              </div>
            </div>

            <button className="utility-card" type="button" onClick={onOpenCalculator}>
              <span className="utility-card-icon" aria-hidden="true">🧮</span>
              <span className="utility-card-copy">
                <strong>Calculator</strong>
                <small>Basic arithmetic and square root</small>
              </span>
              <span className="utility-card-arrow">Open →</span>
            </button>
          </section>

          <div className="arcade-account-actions">
            <button className="text-button" type="button" onClick={onReset}>
              Change name
            </button>
          </div>
        </main>

        <aside className="arcade-leaderboard-rail" aria-label="All game leaderboards">
          <div className="arcade-leaderboard-rail-header">
            <div>
              <p className="eyebrow">Competition</p>
              <h2>🏆 Top scores</h2>
            </div>
            <button type="button" onClick={onOpenLeaderboard}>View all</button>
          </div>

          <div className="arcade-leaderboard-scroll">
            {leaderboardGames.map((game) => (
              <LeaderboardPanel key={game.id} game={game.id} compact />
            ))}
          </div>
        </aside>
      </div>

      <button
        className="arcade-mobile-leaderboard-button"
        type="button"
        onClick={() => setMobileLeaderboardsOpen(true)}
      >
        🏆 View leaderboards
      </button>

      {mobileLeaderboardsOpen && (
        <div
          className="arcade-mobile-leaderboard-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="All game leaderboards"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) setMobileLeaderboardsOpen(false)
          }}
        >
          <div className="arcade-mobile-leaderboard-sheet">
            <div className="arcade-mobile-leaderboard-header">
              <div>
                <p className="eyebrow">Competition</p>
                <h2>🏆 Leaderboards</h2>
              </div>
              <button
                type="button"
                onClick={() => setMobileLeaderboardsOpen(false)}
                aria-label="Close leaderboards"
              >
                ✕
              </button>
            </div>

            <div className="arcade-mobile-leaderboard-list">
              {leaderboardGames.map((game) => (
                <LeaderboardPanel key={game.id} game={game.id} compact />
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
