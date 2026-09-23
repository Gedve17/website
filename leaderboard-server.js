import { createServer } from 'node:http'
import { existsSync } from 'node:fs'
import { DatabaseSync } from 'node:sqlite'
import { URL } from 'node:url'
import { Filter } from 'bad-words'

const port = Number(process.env.PORT || 8787)
const databasePath =
  process.env.LEADERBOARD_DB_PATH || '/data/leaderboard.sqlite'

const validGames = new Set([
  'rps',
  'snake',
  'flappy',
  'tetris',
  'driving',
  'zombie',
  'helicopter',
  'blackjack',
])

const recentRequests = new Map()
const nameFilter = new Filter()
const maxRequestBytes = 10_000

// Do NOT silently create a new database if the Docker volume/path is wrong.
if (!existsSync(databasePath)) {
  console.error(`Leaderboard database not found: ${databasePath}`)
  process.exit(1)
}

const db = new DatabaseSync(databasePath, {
  timeout: 5000,
})

const getAllScores = db.prepare(`
  SELECT
    game,
    player,
    score,
    updated_at AS updatedAt
  FROM scores
  ORDER BY score DESC, player COLLATE NOCASE ASC
  LIMIT 100
`)

const getScoresByGame = db.prepare(`
  SELECT
    game,
    player,
    score,
    updated_at AS updatedAt
  FROM scores
  WHERE game = ?
  ORDER BY score DESC, player COLLATE NOCASE ASC
  LIMIT 100
`)

const upsertScore = db.prepare(`
  INSERT INTO scores (
    game,
    player,
    player_key,
    score,
    updated_at
  )
  VALUES (?, ?, ?, ?, ?)

  ON CONFLICT(game, player_key)
  DO UPDATE SET
    player = excluded.player,
    score = excluded.score,
    updated_at = excluded.updated_at

  WHERE excluded.score > scores.score
`)

function send(response, status, body) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
  })

  response.end(JSON.stringify(body))
}

function isDisallowedName(player) {
  const normalized = player
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()

  const compact = normalized.replace(/\s+/g, '')

  return (
    nameFilter.isProfane(player) ||
    nameFilter.isProfane(normalized) ||
    nameFilter.isProfane(compact)
  )
}

function getClientAddress(request) {
  const forwarded = request.headers['x-forwarded-for']

  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim()
  }

  return request.socket.remoteAddress || 'unknown'
}

function validateScore(payload, request) {
  const player =
    typeof payload.player === 'string' ? payload.player.trim() : ''

  const game =
    typeof payload.game === 'string' ? payload.game : ''

  const score = Number(payload.score)

  const now = Date.now()
  const requestKey = getClientAddress(request)
  const lastRequest = recentRequests.get(requestKey) || 0

  if (!validGames.has(game)) {
    return {
      error: 'Invalid game',
      status: 400,
    }
  }

  if (player.length < 2 || player.length > 20) {
    return {
      error: 'Player name must be 2-20 characters',
      status: 400,
    }
  }

  if (!/^[\p{L}\p{N} ._'-]+$/u.test(player)) {
    return {
      error: 'Player name contains unsupported characters',
      status: 400,
    }
  }

  if (isDisallowedName(player)) {
    return {
      error: 'That player name is not allowed',
      status: 400,
    }
  }

  if (!Number.isInteger(score) || score < 0 || score > 1_000_000) {
    return {
      error: 'Score must be an integer from 0 to 1000000',
      status: 400,
    }
  }

  if (now - lastRequest < 250) {
    return {
      error: 'Too many requests',
      status: 429,
    }
  }

  recentRequests.set(requestKey, now)

  return {
    player,
    playerKey: player.normalize('NFKC').toLowerCase(),
    game,
    score,
  }
}

const server = createServer((request, response) => {
  try {
    const url = new URL(
      request.url,
      `http://${request.headers.host || 'localhost'}`,
    )

    if (
      request.method === 'GET' &&
      url.pathname === '/api/leaderboard'
    ) {
      const game = url.searchParams.get('game')

      if (game && !validGames.has(game)) {
        return send(response, 400, {
          error: 'Invalid game',
        })
      }

      const scores = game
        ? getScoresByGame.all(game)
        : getAllScores.all()

      return send(response, 200, scores)
    }

    if (
      request.method === 'POST' &&
      url.pathname === '/api/leaderboard'
    ) {
      if (
        request.headers['content-type']?.split(';', 1)[0] !==
        'application/json'
      ) {
        return send(response, 415, {
          error: 'Content-Type must be application/json',
        })
      }

      let body = ''

      request.on('data', (chunk) => {
        body += chunk

        if (Buffer.byteLength(body) > maxRequestBytes) {
          response.writeHead(413, {
            'Content-Type': 'application/json; charset=utf-8',
          })

          response.end(
            JSON.stringify({
              error: 'Request body is too large',
            }),
          )

          request.destroy()
        }
      })

      request.on('end', () => {
        if (response.writableEnded) return

        try {
          const payload = JSON.parse(body)
          const validated = validateScore(payload, request)

          if (validated.error) {
            return send(
              response,
              validated.status,
              { error: validated.error },
            )
          }

          const result = upsertScore.run(
            validated.game,
            validated.player,
            validated.playerKey,
            validated.score,
            new Date().toISOString(),
          )

          return send(response, 200, {
            accepted: Boolean(result.changes),
          })
        } catch (error) {
          if (error instanceof SyntaxError) {
            return send(response, 400, {
              error: 'Invalid JSON',
            })
          }

          console.error('Leaderboard POST error:', error)

          return send(response, 500, {
            error: 'Internal server error',
          })
        }
      })

      return
    }

    response.writeHead(404, {
      'Content-Type': 'text/plain; charset=utf-8',
    })

    response.end('Not found')
  } catch (error) {
    console.error('Leaderboard request error:', error)

    if (!response.writableEnded) {
      send(response, 500, {
        error: 'Internal server error',
      })
    }
  }
})

server.listen(port, '0.0.0.0', () => {
  console.log(`Leaderboard API listening on port ${port}`)
  console.log(`Using SQLite database: ${databasePath}`)
})