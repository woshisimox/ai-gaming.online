import type { GameEngine, GameState } from '../../core/types';

export type DebatePhase = 'setup' | 'debate' | 'verdict' | 'finished';

export interface DebateTurnEntry {
  role: 'pro' | 'con' | 'judge';
  content: string;
  round?: number;
}

export interface DebateStateData {
  topic: string;
  phase: DebatePhase;
  rounds: number;
  transcript: DebateTurnEntry[];
  winner: number | null;
}

export type DebateState = GameState<DebateStateData>;
export type DebateAction = { type: 'noop' };

function createInitialState(): DebateState {
  return {
    currentPlayer: 2,
    turn: 0,
    status: 'pending',
    data: {
      topic: '',
      phase: 'setup',
      rounds: 0,
      transcript: [],
      winner: null,
    },
  };
}

export const debateEngine: GameEngine<DebateState, DebateAction> = {
  name: 'AI Debate',
  maxPlayers: 3,
  initialState: () => createInitialState(),
  legalActions: () => [],
  nextState: (state) => state,
  isTerminal: (state) => state.data.phase === 'finished' || state.status === 'finished',
  getWinner: (state) => state.data.winner ?? null,
  encodeState: (state) => JSON.stringify(state),
};
