import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchLeaderboard, leaderboardGames } from './leaderboardApi'
import './Leaderboard.css'

const GAME_ICONS = {
  rps: '✊',
  snake: '🐍',
  flappy: '🐦',
  tetris: '🧱',
  driving: '🏎️',
  zombie: '🧟',
  helicopter: '🚁',
  blackjack: '🃏',
}

const RANK_LABELS = ['🏆', '🥈', '🥉', '4', '5']
const PERIODS = [
  { id: 'day', label: 'Day best', icon: '☀️' },
  { id: 'week', label: 'Week best', icon: '📅' },
  { id: 'month', label: 'Month best', icon: '🗓️' },
]

function getGameMeta(game) {
  return (
    leaderboardGames.find((item) => item.id === game) ?? {
      id: game,
      label: game,
    }
  )
}

function rankClass(index) {
  if (index === 0) return 'leaderboard-rank leaderboard-rank-first'
  if (index === 1) return 'leaderboard-rank leaderboard-rank-second'
  if (index === 2) return 'leaderboard-rank leaderboard-rank-third'
  return 'leaderboard-rank'
}

function getPeriodStart(period) {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  if (period === 'week') start.setDate(start.getDate() - start.getDay())
  if (period === 'month') start.setDate(1)
  return start
}

export function LeaderboardPanel({
  game,
  compact = false,
  refreshKey = 0,
  showHeader = true,
  showPeriods = false,
}) {
  const [entries, setEntries] = useState([])
  const [status, setStatus] = useState('loading')
  const gameMeta = useMemo(() => getGameMeta(game), [game])

  const loadLeaderboard = useCallback(async () => {
    setStatus('loading')

    try {
      const data = await fetchLeaderboard(game)

      if (!Array.isArray(data)) {
        throw new Error('Leaderboard API response is not an array.')
      }

      setEntries(data)
      setStatus('ready')
    } catch (error) {
      console.error(`Unable to load ${game} leaderboard:`, error)
      setEntries([])
      setStatus('error')
    }
  }, [game])

  useEffect(() => {
    loadLeaderboard()
  }, [loadLeaderboard, refreshKey])

  useEffect(() => {
    const handleFocus = () => {
      loadLeaderboard()
    }

    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [loadLeaderboard])

  return (
    <section
      className={`leaderboard-panel${compact ? ' leaderboard-panel-compact' : ''}`}
      aria-label={`${gameMeta.label} leaderboard`}
    >
      {showHeader && (
        <div className="leaderboard-panel-header">
          <div className="leaderboard-panel-title">
            <p>{showPeriods ? 'Top 5 + time records' : 'Top 5'}</p>
            <h3>{gameMeta.label}</h3>
          </div>

          <span className="leaderboard-panel-icon" aria-hidden="true">
            {GAME_ICONS[game] ?? '🎮'}
          </span>
        </div>
      )}

      {status === 'loading' && (
        <p className="leaderboard-loading">Loading leaderboard…</p>
      )}

      {status === 'error' && (
        <p className="leaderboard-error">Unable to load leaderboard.</p>
      )}

      {status === 'ready' && entries.length === 0 && (
        <p className="leaderboard-empty">No scores yet.</p>
      )}

      {status === 'ready' && entries.length > 0 && (
        <ol className="leaderboard-list">
          {entries.slice(0, 5).map((entry, index) => (
            <li
              className="leaderboard-row"
              key={`${game}-${entry.player}-${index}`}
            >
              <span className={rankClass(index)} aria-label={`Rank ${index + 1}`}>
                {RANK_LABELS[index]}
              </span>
              <span className="leaderboard-player" title={entry.player}>
                {entry.player}
              </span>
              <strong className="leaderboard-score">
                {Number(entry.score).toLocaleString()}
              </strong>
            </li>
          ))}
        </ol>
      )}

      {status === 'ready' && showPeriods && entries.length > 0 && (
        <>
          <p className="leaderboard-period-heading">Best by period</p>
          <ol className="leaderboard-list leaderboard-period-list">
            {PERIODS.map((period, index) => {
              const periodStart = getPeriodStart(period.id)
              const entry = entries
                .filter((item) => new Date(item.updatedAt) >= periodStart)
                .sort((first, second) => second.score - first.score)[0]

              return (
                <li className="leaderboard-row" key={`${game}-${period.id}`}>
                  <span className={rankClass(index)} aria-label={period.label}>
                    {period.icon}
                  </span>
                  <span
                    className="leaderboard-player leaderboard-period-player"
                    title={entry ? `${period.label}: ${entry.player}` : `${period.label}: No score`}
                  >
                    <small>{period.label}</small>
                    {entry ? entry.player : 'No score'}
                  </span>
                  <strong className="leaderboard-score">
                    {entry ? Number(entry.score).toLocaleString() : '—'}
                  </strong>
                </li>
              )
            })}
          </ol>
        </>
      )}

    </section>
  )
}

export function MenuLeaderboardColumn({ side, refreshKey = 0 }) {
  const half = Math.ceil(leaderboardGames.length / 2)
  const games =
    side === 'right'
      ? leaderboardGames.slice(half)
      : leaderboardGames.slice(0, half)

  return (
    <aside
      className={`menu-leaderboard-column menu-leaderboard-column-${side}`}
      aria-label={`${side} leaderboard column`}
    >
      {games.map((game) => (
        <LeaderboardPanel
          key={game.id}
          game={game.id}
          compact
          refreshKey={refreshKey}
        />
      ))}
    </aside>
  )
}

export function GameLeaderboard({
  game,
  refreshKey = 0,
  buttonLabel = '🏆 Leaderboard',
}) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const gameMeta = useMemo(() => getGameMeta(game), [game])

  useEffect(() => {
    if (!mobileOpen) return undefined

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setMobileOpen(false)
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [mobileOpen])

  return (
    <>
      <aside className="game-leaderboard-sidebar">
        <LeaderboardPanel game={game} refreshKey={refreshKey} showPeriods />
      </aside>

      <button
        className="mobile-leaderboard-button"
        type="button"
        onClick={() => setMobileOpen(true)}
      >
        {buttonLabel}
      </button>

      <div
        className={`mobile-leaderboard-overlay${mobileOpen ? ' is-open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={`${gameMeta.label} leaderboard`}
        onMouseDown={(event) => {
          if (event.currentTarget === event.target) setMobileOpen(false)
        }}
      >
        <div className="mobile-leaderboard-sheet">
          <div className="mobile-leaderboard-sheet-header">
            <h3>
              🏆 {gameMeta.label}
            </h3>

            <button
              className="mobile-leaderboard-close"
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Close leaderboard"
            >
              ✕
            </button>
          </div>

          <LeaderboardPanel
            game={game}
            refreshKey={refreshKey}
            showHeader={false}
            showPeriods
          />
        </div>
      </div>
    </>
  )
}

export default LeaderboardPanel
