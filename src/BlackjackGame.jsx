import { useMemo, useState } from 'react'
import './BlackjackGame.css'

const SUITS = [
  { symbol: '♠', name: 'Spades' },
  { symbol: '♥', name: 'Hearts' },
  { symbol: '♦', name: 'Diamonds' },
  { symbol: '♣', name: 'Clubs' },
]

const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K']

function createDeck() {
  return SUITS.flatMap((suit) =>
    RANKS.map((rank) => ({
      suit: suit.symbol,
      suitName: suit.name,
      rank,
      id: `${rank}-${suit.name}`,
    }))
  )
}

function shuffleDeck(deck) {
  const shuffled = [...deck]

  for (let i = shuffled.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }

  return shuffled
}

function cardValue(rank) {
  if (rank === 'A') return 11
  if (['K', 'Q', 'J'].includes(rank)) return 10
  return Number(rank)
}

function calculateHand(hand) {
  let total = hand.reduce((sum, card) => sum + cardValue(card.rank), 0)
  let aces = hand.filter((card) => card.rank === 'A').length

  while (total > 21 && aces > 0) {
    total -= 10
    aces -= 1
  }

  return total
}

function isBlackjack(hand) {
  return hand.length === 2 && calculateHand(hand) === 21
}

function isRedSuit(suit) {
  return suit === '♥' || suit === '♦'
}

function Card({ card, hidden = false }) {
  if (hidden) {
    return (
      <div className="blackjack-card blackjack-card-back" aria-label="Hidden dealer card">
        <div className="blackjack-card-pattern">Y9</div>
      </div>
    )
  }

  const red = isRedSuit(card.suit)

  return (
    <div
      className={`blackjack-card${red ? ' blackjack-card-red' : ''}`}
      aria-label={`${card.rank} of ${card.suitName}`}
    >
      <div className="blackjack-card-corner">
        <strong>{card.rank}</strong>
        <span>{card.suit}</span>
      </div>

      <div className="blackjack-card-suit">{card.suit}</div>

      <div className="blackjack-card-corner blackjack-card-corner-bottom">
        <strong>{card.rank}</strong>
        <span>{card.suit}</span>
      </div>
    </div>
  )
}

export default function BlackjackGame({ onBack }) {
  const initialGame = useMemo(() => {
    const deck = shuffleDeck(createDeck())

    return {
      deck: deck.slice(4),
      player: [deck[0], deck[2]],
      dealer: [deck[1], deck[3]],
    }
  }, [])

  const [deck, setDeck] = useState(initialGame.deck)
  const [playerHand, setPlayerHand] = useState(initialGame.player)
  const [dealerHand, setDealerHand] = useState(initialGame.dealer)
  const [status, setStatus] = useState('playing')
  const [, setMessage] = useState('Hit or stand?')
  const [stats, setStats] = useState({
    wins: 0,
    losses: 0,
    pushes: 0,
  })

  const playerTotal = calculateHand(playerHand)
  const dealerTotal = calculateHand(dealerHand)

  const roundOver = status === 'finished'

  const updateStats = (result) => {
    setStats((current) => ({
      ...current,
      [result]: current[result] + 1,
    }))
  }

  const finishRound = (resultMessage, resultType) => {
    setStatus('finished')
    setMessage(resultMessage)

    if (resultType) {
      updateStats(resultType)
    }
  }

  const startNewRound = () => {
    const freshDeck = shuffleDeck(createDeck())
    const nextPlayer = [freshDeck[0], freshDeck[2]]
    const nextDealer = [freshDeck[1], freshDeck[3]]

    setDeck(freshDeck.slice(4))
    setPlayerHand(nextPlayer)
    setDealerHand(nextDealer)
    setStatus('playing')

    const playerBJ = isBlackjack(nextPlayer)
    const dealerBJ = isBlackjack(nextDealer)

    if (playerBJ && dealerBJ) {
      setStatus('finished')
      setMessage('Both have Blackjack — push!')
      updateStats('pushes')
    } else if (playerBJ) {
      setStatus('finished')
      setMessage('Blackjack! You win!')
      updateStats('wins')
    } else if (dealerBJ) {
      setStatus('finished')
      setMessage('Dealer has Blackjack.')
      updateStats('losses')
    } else {
      setMessage('Hit or stand?')
    }
  }

  const hit = () => {
    if (roundOver || deck.length === 0) return

    const nextCard = deck[0]
    const nextHand = [...playerHand, nextCard]
    const nextDeck = deck.slice(1)
    const nextTotal = calculateHand(nextHand)

    setPlayerHand(nextHand)
    setDeck(nextDeck)

    if (nextTotal > 21) {
      finishRound(`Bust! You had ${nextTotal}.`, 'losses')
    } else if (nextTotal === 21) {
      standWithState(nextHand, dealerHand, nextDeck)
    } else {
      setMessage('Hit or stand?')
    }
  }

  const standWithState = (currentPlayer, currentDealer, currentDeck) => {
    if (status === 'finished') return

    let dealer = [...currentDealer]
    let remainingDeck = [...currentDeck]

    while (calculateHand(dealer) < 17 && remainingDeck.length > 0) {
      dealer.push(remainingDeck[0])
      remainingDeck = remainingDeck.slice(1)
    }

    setDealerHand(dealer)
    setDeck(remainingDeck)

    const finalPlayerTotal = calculateHand(currentPlayer)
    const finalDealerTotal = calculateHand(dealer)

    if (finalDealerTotal > 21) {
      finishRound(`Dealer busts with ${finalDealerTotal}. You win!`, 'wins')
      return
    }

    if (finalPlayerTotal > finalDealerTotal) {
      finishRound(
        `You win ${finalPlayerTotal} to ${finalDealerTotal}!`,
        'wins'
      )
      return
    }

    if (finalPlayerTotal < finalDealerTotal) {
      finishRound(
        `Dealer wins ${finalDealerTotal} to ${finalPlayerTotal}.`,
        'losses'
      )
      return
    }

    finishRound(`Push at ${finalPlayerTotal}.`, 'pushes')
  }

  const stand = () => {
    if (roundOver) return
    standWithState(playerHand, dealerHand, deck)
  }

  const visibleDealerTotal = roundOver
    ? dealerTotal
    : dealerHand.length > 0
      ? calculateHand([dealerHand[0]])
      : 0

  return (
    <section className="screen blackjack-screen">
      <div className="blackjack-shell">
        <div className="blackjack-header">
          <button className="secondary-button" type="button" onClick={onBack}>
            ← Back
          </button>

          <h2>Blackjack</h2>

          <div className="blackjack-stats">
            W {stats.wins} · L {stats.losses} · P {stats.pushes}
          </div>
        </div>

        <div className="blackjack-table">
          <div className="blackjack-table-decor" aria-hidden="true" />
          <div className="blackjack-table-suits" aria-hidden="true">
            <span className="blackjack-suit-spade">♠</span>
            <span className="blackjack-suit-club">♣</span>
          </div>

          <div className="blackjack-table-ring" aria-hidden="true" />

          <div className="blackjack-table-rule" aria-hidden="true">
            DEALER DRAWS TO 16 · STANDS ON 17
          </div>
          <div className="blackjack-table-title">BLACKJACK</div>

          <div className="blackjack-hand-section blackjack-dealer-section">
            <div className="blackjack-hand-heading">
              <span>Dealer</span>
              <strong>{visibleDealerTotal}</strong>
            </div>

            <div className="blackjack-hand">
              {dealerHand.map((card, index) => (
                <Card
                  key={`${card.id}-${index}`}
                  card={card}
                  hidden={!roundOver && index === 1}
                />
              ))}
            </div>
          </div>

          <div className="blackjack-hand-section blackjack-player-section">
            <div className="blackjack-hand-heading">
              <span>You</span>
              <strong className={playerTotal > 21 ? 'blackjack-bust-total' : ''}>
                {playerTotal}
              </strong>
            </div>

            <div className="blackjack-hand">
              {playerHand.map((card, index) => (
                <Card key={`${card.id}-${index}`} card={card} />
              ))}
            </div>
          </div>
        </div>

        <div className="blackjack-actions">
          {!roundOver ? (
            <>
              <button
                className="primary-button blackjack-hit-button"
                type="button"
                onClick={hit}
              >
                Hit
              </button>

              <button
                className="secondary-button blackjack-stand-button"
                type="button"
                onClick={stand}
              >
                Stand
              </button>
            </>
          ) : (
            <button
              className="primary-button"
              type="button"
              onClick={startNewRound}
            >
              New round
            </button>
          )}
        </div>

        <p className="blackjack-help">
          Get as close to 21 as possible without going over. Dealer stands on 17.
        </p>
      </div>
    </section>
  )
}
