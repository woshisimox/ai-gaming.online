import type { GameEngine, GameState } from '../../core/types';
import config from './config.json';

type Suit = 'm' | 'p' | 's';
type Honor = 'E' | 'S' | 'W' | 'N' | 'C' | 'F' | 'P';
export type Tile = `${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}${Suit}` | Honor;

export type MahjongAction =
  | { type: 'discard'; tile: Tile }
  | { type: 'win' };

export interface MahjongStateData {
  hands: Tile[][];
  wall: Tile[];
  dealer: number;
  history: Array<{ seat: number; type: 'discard'; tile: Tile } | { seat: number; type: 'win' }>;
  winner: number | null;
}

export type MahjongState = GameState<MahjongStateData>;

const SUITS: Suit[] = ['m', 'p', 's'];
const HONORS: Honor[] = ['E', 'S', 'W', 'N', 'C', 'F', 'P'];

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rng: () => number): T[] {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function createWall(): Tile[] {
  const wall: Tile[] = [];
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 9; rank += 1) {
      for (let i = 0; i < 4; i += 1) {
        wall.push(`${rank as 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9}${suit}`);
      }
    }
  }
  for (const honor of HONORS) {
    for (let i = 0; i < 4; i += 1) {
      wall.push(honor);
    }
  }
  return wall;
}

function tileIndex(tile: Tile): number {
  if (tile.length === 2) {
    const rank = Number(tile[0]);
    const suit = tile[1] as Suit;
    const suitOffset = suit === 'm' ? 0 : suit === 'p' ? 9 : 18;
    return suitOffset + rank - 1;
  }
  return 27 + HONORS.indexOf(tile as Honor);
}

function sortTiles(tiles: Tile[]): Tile[] {
  return tiles.slice().sort((a, b) => tileIndex(a) - tileIndex(b));
}

function removeTile(hand: Tile[], tile: Tile): Tile[] {
  const idx = hand.indexOf(tile);
  if (idx < 0) {
    throw new Error(`Tile ${tile} not in hand.`);
  }
  const next = hand.slice();
  next.splice(idx, 1);
  return next;
}

function countsFromHand(hand: Tile[]): number[] {
  const counts = Array.from({ length: 34 }, () => 0);
  hand.forEach((tile) => {
    counts[tileIndex(tile)] += 1;
  });
  return counts;
}

function canFormSets(counts: number[]): boolean {
  const idx = counts.findIndex((n) => n > 0);
  if (idx === -1) return true;

  if (counts[idx] >= 3) {
    counts[idx] -= 3;
    if (canFormSets(counts)) {
      counts[idx] += 3;
      return true;
    }
    counts[idx] += 3;
  }

  if (idx <= 26) {
    const mod = idx % 9;
    if (mod <= 6 && counts[idx + 1] > 0 && counts[idx + 2] > 0) {
      counts[idx] -= 1;
      counts[idx + 1] -= 1;
      counts[idx + 2] -= 1;
      if (canFormSets(counts)) {
        counts[idx] += 1;
        counts[idx + 1] += 1;
        counts[idx + 2] += 1;
        return true;
      }
      counts[idx] += 1;
      counts[idx + 1] += 1;
      counts[idx + 2] += 1;
    }
  }
  return false;
}

function isWinningHand(hand: Tile[]): boolean {
  if (hand.length % 3 !== 2) return false;
  const base = countsFromHand(hand);
  for (let i = 0; i < 34; i += 1) {
    if (base[i] < 2) continue;
    const counts = base.slice();
    counts[i] -= 2;
    if (canFormSets(counts)) {
      return true;
    }
  }
  return false;
}

function cloneData(data: MahjongStateData): MahjongStateData {
  return {
    hands: data.hands.map((h) => h.slice()),
    wall: data.wall.slice(),
    dealer: data.dealer,
    history: data.history.map((h) => ({ ...h })),
    winner: data.winner,
  };
}

export const mahjongEngine: GameEngine<MahjongState, MahjongAction> = {
  name: config.id,
  maxPlayers: config.maxPlayers,
  initialState(seed) {
    const rng = typeof seed === 'number' ? mulberry32(seed) : () => Math.random();
    const deck = shuffle(createWall(), rng);
    const dealer = 0;
    const hands: Tile[][] = [
      sortTiles(deck.splice(0, 14)),
      sortTiles(deck.splice(0, 13)),
      sortTiles(deck.splice(0, 13)),
      sortTiles(deck.splice(0, 13)),
    ];

    return {
      currentPlayer: dealer,
      turn: 0,
      status: 'running',
      data: {
        hands,
        wall: deck,
        dealer,
        history: [],
        winner: null,
      },
    };
  },
  legalActions(state) {
    if (state.status === 'finished') return [];
    const hand = state.data.hands[state.currentPlayer] ?? [];
    const actions: MahjongAction[] = hand.map((tile) => ({ type: 'discard', tile }));
    if (isWinningHand(hand)) {
      actions.unshift({ type: 'win' });
    }
    return actions;
  },
  nextState(state, action) {
    if (state.status === 'finished') return state;
    const data = cloneData(state.data);
    const seat = state.currentPlayer;

    if (action.type === 'win') {
      if (!isWinningHand(data.hands[seat])) {
        throw new Error('Current hand is not a winning hand.');
      }
      data.history.push({ seat, type: 'win' });
      data.winner = seat;
      return {
        ...state,
        turn: state.turn + 1,
        status: 'finished',
        data,
      };
    }

    data.hands[seat] = sortTiles(removeTile(data.hands[seat], action.tile));
    data.history.push({ seat, type: 'discard', tile: action.tile });

    if (data.wall.length === 0) {
      return {
        currentPlayer: seat,
        turn: state.turn + 1,
        status: 'finished',
        data,
      };
    }

    const nextSeat = (seat + 1) % mahjongEngine.maxPlayers;
    const draw = data.wall.shift();
    if (draw) {
      data.hands[nextSeat] = sortTiles([...data.hands[nextSeat], draw]);
    }

    return {
      currentPlayer: nextSeat,
      turn: state.turn + 1,
      status: 'running',
      data,
    };
  },
  isTerminal(state) {
    return state.status === 'finished';
  },
  getWinner(state) {
    return state.data.winner;
  },
  encodeState(state, player) {
    const hand = state.data.hands[player]?.join(' ') ?? '';
    const history = state.data.history
      .slice(-10)
      .map((event) => (event.type === 'win' ? `seat${event.seat}:win` : `seat${event.seat}:discard ${event.tile}`))
      .join('\n');

    return [
      `game:${config.id}`,
      `player:${player}`,
      `turn:${state.turn}`,
      `current:${state.currentPlayer}`,
      `wall:${state.data.wall.length}`,
      `hand:${hand}`,
      'history:',
      history || 'none',
    ].join('\n');
  },
};

export type MahjongEngine = typeof mahjongEngine;
