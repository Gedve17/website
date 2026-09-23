import { Filter } from 'bad-words'

const leaderboardUrl = '/api/leaderboard'
const nameFilter = new Filter()

export const leaderboardGames = [
  { id: 'rps', label: 'Rock Paper Scissors' },
  { id: 'snake', label: 'Snake' },
  { id: 'flappy', label: 'Flappy Bird' },
  { id: 'tetris', label: 'Tetris' },
  { id: 'driving', label: 'Driving' },
  { id: 'zombie', label: 'Zombie Defense' },
  { id: 'helicopter', label: 'Helicopter Assault' },
  { id: 'blackjack', label: 'Blackjack (wins)' },
]

export function validatePlayerName(value) {
  const player = value.trim()
  const normalized = player.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()
  const compact = normalized.replace(/\s+/g, '')

  if (!player) return 'Enter a player name.'
  if (player.length < 2 || player.length > 20) return 'Player names must be 2-20 characters.'
  if (!/^[\p{L}\p{N} ._'-]+$/u.test(player)) return 'Use letters, numbers, spaces, dots, underscores, or hyphens.'
  if (nameFilter.isProfane(player) || nameFilter.isProfane(normalized) || nameFilter.isProfane(compact)) {
    return 'That player name is not allowed.'
  }
  return ''
}

export async function submitLeaderboardScore(game, player, score) {
  const response = await fetch(leaderboardUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ game, player, score }),
  })

  if (!response.ok) throw new Error('Unable to submit score')
  return response.json()
}

export async function fetchLeaderboard(game) {
  const query = game ? `?game=${encodeURIComponent(game)}` : ''
  const response = await fetch(`${leaderboardUrl}${query}`)

  if (!response.ok) throw new Error('Unable to load leaderboard')
  return response.json()
}
