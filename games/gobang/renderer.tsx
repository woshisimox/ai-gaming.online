'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import type { GobangAction, GobangState } from './game';
import { gobangEngine } from './game';
import styles from './renderer.module.css';
import {
  Rating,
  TS_DEFAULT,
  applyRatingsFromStore,
  createTrueSkillStore,
  readTrueSkillStore,
  writeTrueSkillStore,
  tsUpdateTwoTeams,
  importTrueSkillArchive,
  formatTrueSkillArchiveName,
  type TrueSkillStore,
} from '../../lib/game-modules/trueSkill';
import {
  LatencyStore,
  ensureLatencyStore,
  readLatencyStore,
  writeLatencyStore,
  updateLatencyStats,
} from '../../lib/game-modules/latencyStore';
import { readPlayerConfigs, writePlayerConfigs } from '../../lib/game-modules/playerConfigStore';

const BOARD_SIZE = gobangEngine.initialState().data.board.length;

interface PlayerPresentation {
  id: 0 | 1;
  name: string;
  avatar: string;
  flag: string;
  rating: number;
  delta: number;
  stoneFill: string;
  shadow: string;
}

const PLAYERS: PlayerPresentation[] = [
  {
    id: 0,
    name: 'simoX',
    avatar: '🧠',
    flag: '🇯🇵',
    rating: 1012,
    delta: 12,
    stoneFill: 'radial-gradient(circle at 30% 25%, rgba(255,255,255,0.95), #fb7185)',
    shadow: '0 12px 30px rgba(248, 113, 113, 0.45)',
  },
  {
    id: 1,
    name: 'Paper Man',
    avatar: '🤖',
    flag: '🇨🇳',
    rating: 998,
    delta: -12,
    stoneFill: 'radial-gradient(circle at 30% 25%, rgba(255,255,255,0.95), #34d399)',
    shadow: '0 12px 30px rgba(16, 185, 129, 0.45)',
  },
];

const INTERSECTION_HIT_SIZE = `calc((100% / ${BOARD_SIZE}) * 1.15)`;
// Size tokens are relative to each intersection's hit area so that the stones scale
// proportionally with the rendered board instead of being divided twice by the board size.
const STONE_SIZE = 'calc(100% * 0.42)';
const GUIDE_DOT_SIZE = 'calc(100% * 0.22)';
const LAST_MOVE_RING_SIZE = 'calc(100% * 0.54)';

const WIN_LENGTH = 5;

function createPendingInitialState(): GobangState {
  const initial = gobangEngine.initialState();
  return {
    ...initial,
    status: 'pending',
  };
}

type PlayerMode =
  | 'human'
  | 'builtin:random'
  | 'ai:openai'
  | 'ai:deepseek'
  | 'ai:gemini'
  | 'ai:grok'
  | 'ai:kimi'
  | 'ai:qwen'
  | 'http';

interface PlayerConfig {
  mode: PlayerMode;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
  token?: string;
}

const MODE_LABEL: Record<PlayerMode, string> = {
  human: '人类选手',
  'builtin:random': '内置 AI：随机+靠近',
  'ai:openai': '外置 AI：OpenAI',
  'ai:deepseek': '外置 AI：DeepSeek',
  'ai:gemini': '外置 AI：Gemini',
  'ai:grok': '外置 AI：Grok',
  'ai:kimi': '外置 AI：Kimi',
  'ai:qwen': '外置 AI：Qwen',
  http: '外置 AI：HTTP Hook',
};

const MODE_GROUPS: Array<{
  label: string;
  options: Array<{ value: PlayerMode; label: string; disabled?: boolean }>;
}> = [
  {
    label: '人类',
    options: [{ value: 'human', label: '人类选手' }],
  },
  {
    label: '内置算法',
    options: [{ value: 'builtin:random', label: '内置 AI：随机+靠近' }],
  },
  {
    label: '外置 AI',
    options: [
      { value: 'ai:openai', label: 'OpenAI' },
      { value: 'ai:deepseek', label: 'DeepSeek' },
      { value: 'ai:gemini', label: 'Gemini', disabled: true },
      { value: 'ai:grok', label: 'Grok', disabled: true },
      { value: 'ai:kimi', label: 'Kimi' },
      { value: 'ai:qwen', label: 'Qwen' },
      { value: 'http', label: 'HTTP Hook', disabled: true },
    ],
  },
];

const PLAYER_STORAGE_KEY = 'gobang_player_configs_v1';
const TS_STORE_KEY = 'gobang_ts_store_v1';
const TS_SCHEMA = 'gobang-trueskill@1';
const LATENCY_KEY = 'gobang_latency_store_v1';
const LATENCY_SCHEMA = 'gobang-latency@1';

function sanitizePlayerConfig(raw?: PlayerConfig): PlayerConfig {
  if (!raw || typeof raw !== 'object') return { mode: 'human' };
  const safeMode = (raw.mode && MODE_LABEL[raw.mode]) ? raw.mode : 'human';
  const next: PlayerConfig = { mode: safeMode };
  if (raw.model) next.model = raw.model;
  if (raw.apiKey) next.apiKey = raw.apiKey;
  if (raw.baseUrl) next.baseUrl = raw.baseUrl;
  if (raw.token) next.token = raw.token;
  return next;
}

function buildPlayerIdentity(config: PlayerConfig, index: number): { id: string; label: string } {
  const mode = config.mode ?? 'human';
  if (mode.startsWith('ai:')) {
    const model = (config.model ?? '').trim();
    const base = (config.baseUrl ?? '').trim();
    const label = `${MODE_LABEL[mode] ?? mode}${model ? `:${model}` : ''}`;
    return { id: `${mode}|${model}|${base}`, label };
  }
  if (mode === 'http') {
    const base = (config.baseUrl ?? '').trim();
    const label = `${MODE_LABEL[mode] ?? mode}${base ? `:${base}` : ''}`;
    return { id: `${mode}|${base}`, label };
  }
  if (mode.startsWith('builtin')) {
    return { id: mode, label: MODE_LABEL[mode] ?? mode };
  }
  return { id: `human:${index}`, label: index === 0 ? '黑方（人类）' : '白方（人类）' };
}

type MoveOrigin = 'human' | 'ai' | 'resign';

interface MoveLogEntry {
  turn: number;
  player: 0 | 1;
  row: number | null;
  col: number | null;
  coordinate: string;
  origin: MoveOrigin;
  note?: string;
}

const STAR_POINTS: Array<{ row: number; col: number }> = [
  { row: 3, col: 3 },
  { row: 3, col: 11 },
  { row: 7, col: 7 },
  { row: 11, col: 3 },
  { row: 11, col: 11 },
];

const BOARD_GRADIENT_ID = 'gobangBoardGradient';
const BOARD_LINE_COLOR = 'rgba(148, 163, 184, 0.28)';
const BOARD_STAR_COLOR = 'rgba(226, 232, 240, 0.8)';

function formatCoordinate(row: number, col: number): string {
  const letter = String.fromCharCode('A'.charCodeAt(0) + col);
  return `${letter}${row + 1}`;
}

function formatDelta(delta: number): string {
  if (delta === 0) return '±0';
  return delta > 0 ? `+${delta}` : `${delta}`;
}

function formatTrueSkillStat(rating?: Rating) {
  if (!rating) return 'μ — · σ —';
  return `μ ${rating.mu.toFixed(2)} · σ ${rating.sigma.toFixed(2)}`;
}

function formatConfidence(rating?: Rating) {
  if (!rating) return 'CR —';
  const cr = rating.mu - 3 * rating.sigma;
  return `CR ${cr.toFixed(2)}`;
}

function inBounds(row: number, col: number): boolean {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

function countDirection(board: GobangState['data']['board'], row: number, col: number, dr: number, dc: number, player: 0 | 1): number {
  let r = row + dr;
  let c = col + dc;
  let count = 0;

  while (inBounds(r, c) && board[r][c] === player) {
    count += 1;
    r += dr;
    c += dc;
  }

  return count;
}

function wouldCompleteFive(board: GobangState['data']['board'], row: number, col: number, player: 0 | 1): boolean {
  const directions: Array<[number, number]> = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1],
  ];

  return directions.some(([dr, dc]) => {
    const forward = countDirection(board, row, col, dr, dc, player);
    const backward = countDirection(board, row, col, -dr, -dc, player);
    return forward + backward + 1 >= WIN_LENGTH;
  });
}

function pickBuiltinMove(state: GobangState, legal: GobangAction[]): { action: GobangAction; note?: string } {
  if (legal.length === 0) {
    throw new Error('No legal moves available.');
  }

  const board = state.data.board;
  const current = state.currentPlayer as 0 | 1;
  const opponent = ((current + 1) % gobangEngine.maxPlayers) as 0 | 1;

  // 1. Win immediately if possible.
  const winningMove = legal.find((move) => wouldCompleteFive(board, move.row, move.col, current));
  if (winningMove) {
    return { action: winningMove, note: '形成连五，立即获胜。' };
  }

  // 2. Block opponent's immediate win threat.
  const blockingMove = legal.find((move) => wouldCompleteFive(board, move.row, move.col, opponent));
  if (blockingMove) {
    return { action: blockingMove, note: '阻挡对手即将连成五子。' };
  }

  const { lastMove } = state.data;
  if (lastMove) {
    const nearby = legal.filter((move) => Math.abs(move.row - lastMove.row) <= 1 && Math.abs(move.col - lastMove.col) <= 1);
    if (nearby.length > 0) {
      const choice = nearby[Math.floor(Math.random() * nearby.length)];
      return { action: choice, note: '沿着最新战线继续进攻。' };
    }
  }

  const center = (BOARD_SIZE - 1) / 2;
  let best = legal[0];
  let bestScore = Number.POSITIVE_INFINITY;

  legal.forEach((move) => {
    const score = Math.abs(move.row - center) + Math.abs(move.col - center);
    if (score < bestScore) {
      best = move;
      bestScore = score;
    }
  });

  return { action: best, note: '靠近棋盘中心掌握主动。' };
}

function getMatchStatus(state: GobangState): string {
  if (state.status === 'pending') {
    return '准备开始对局';
  }

  const { winner } = state.data;
  if (winner !== null) {
    return `${PLAYERS[winner].name} 获胜`;
  }
  if (state.status === 'finished') {
    return '对局结束';
  }
  return `${PLAYERS[state.currentPlayer as 0 | 1].name} 落子`;
}

export default function GobangRenderer() {
  const initialPlayerConfigsRef = useRef<PlayerConfig[] | null>(null);
  if (!initialPlayerConfigsRef.current) {
    const stored = readPlayerConfigs<PlayerConfig>(
      PLAYER_STORAGE_KEY,
      () => [
        { mode: 'human' },
        { mode: 'builtin:random' },
      ],
      sanitizePlayerConfig,
    );
    initialPlayerConfigsRef.current = stored.length
      ? stored
      : [
          { mode: 'human' },
          { mode: 'builtin:random' },
        ];
  }
  const [state, setState] = useState<GobangState>(createPendingInitialState);
  const [moveLog, setMoveLog] = useState<MoveLogEntry[]>([]);
  const [playerConfigs, setPlayerConfigs] = useState<PlayerConfig[]>(
    () => initialPlayerConfigsRef.current ?? [
        { mode: 'human' },
        { mode: 'builtin:random' },
      ],
  );
  const [aiStatus, setAiStatus] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const aiTicketRef = useRef(0);
  const tsStoreRef = useRef<TrueSkillStore>(readTrueSkillStore(TS_STORE_KEY, TS_SCHEMA));
  const [tsRatings, setTsRatings] = useState<Rating[]>(() => {
    const baseConfigs = initialPlayerConfigsRef.current ?? [
      { mode: 'human' },
      { mode: 'builtin:random' },
    ];
    const identities = baseConfigs.map((config, index) => ({ id: buildPlayerIdentity(config, index).id }));
    return applyRatingsFromStore(tsStoreRef.current ?? createTrueSkillStore(TS_SCHEMA), identities);
  });
  const tsFileRef = useRef<HTMLInputElement | null>(null);
  const [latencyStore, setLatencyStore] = useState<LatencyStore>(() =>
    readLatencyStore(LATENCY_KEY, LATENCY_SCHEMA),
  );
  const latencyStoreRef = useRef(latencyStore);
  useEffect(() => { latencyStoreRef.current = latencyStore; }, [latencyStore]);
  const [lastLatency, setLastLatency] = useState<Array<number | null>>([null, null]);
  const lastRecordedTurnRef = useRef<number | null>(null);

  const legalMoves = useMemo(() => {
    if (state.status !== 'running') {
      return [] as GobangAction[];
    }
    return gobangEngine.legalActions(state);
  }, [state]);
  const matchStatus = getMatchStatus(state);
  const { board, lastMove } = state.data;
  const hasStarted = state.status !== 'pending';

  useEffect(() => {
    writePlayerConfigs(PLAYER_STORAGE_KEY, playerConfigs, sanitizePlayerConfig);
  }, [playerConfigs]);

  const ensureTsStore = useCallback(() => {
    if (!tsStoreRef.current) {
      tsStoreRef.current = createTrueSkillStore(TS_SCHEMA);
    }
    return tsStoreRef.current;
  }, []);

  const applyStoredRatings = useCallback(() => {
    const identities = [0, 1].map((index) => ({
      id: buildPlayerIdentity(playerConfigs[index] ?? { mode: 'human' }, index).id,
    }));
    const store = ensureTsStore();
    setTsRatings(applyRatingsFromStore(store, identities));
  }, [ensureTsStore, playerConfigs]);

  useEffect(() => {
    applyStoredRatings();
  }, [applyStoredRatings]);

  useEffect(() => {
    if (state.status !== 'finished' || state.data.winner == null) return;
    if (lastRecordedTurnRef.current === state.turn) return;
    lastRecordedTurnRef.current = state.turn;
    const winner = state.data.winner as 0 | 1;
    const loser = (winner === 0 ? 1 : 0) as 0 | 1;
    const updated = tsRatings.map((rating) => ({ ...rating }));
    tsUpdateTwoTeams(updated, [winner], [loser]);
    setTsRatings(updated);
    const store = ensureTsStore();
    const identities = [0, 1].map((index) => buildPlayerIdentity(playerConfigs[index] ?? { mode: 'human' }, index));
    identities.forEach((identity, index) => {
      const role = index === 0 ? 'black' : 'white';
      const entry = store.players[identity.id] || { id: identity.id, roles: {} };
      entry.overall = { ...updated[index] };
      entry.roles = { ...(entry.roles || {}), [role]: { ...updated[index] } };
      entry.label = identity.label;
      store.players[identity.id] = entry;
    });
    tsStoreRef.current = writeTrueSkillStore(TS_STORE_KEY, store);
  }, [ensureTsStore, playerConfigs, state.data.winner, state.status, state.turn, tsRatings]);

  const applyAction = useCallback((action: GobangAction, origin: MoveOrigin, note?: string) => {
    setState((previous) => {
      if (previous.status !== 'running') {
        return previous;
      }

      const nextState = gobangEngine.nextState(previous, action);
      const player = previous.currentPlayer as 0 | 1;

      setMoveLog((history) => [
        ...history,
        {
          turn: previous.turn + 1,
          player,
          row: action.row,
          col: action.col,
          coordinate: formatCoordinate(action.row, action.col),
          origin,
          note,
        },
      ]);

      return nextState;
    });
  }, []);

  const handleCellClick = useCallback(
    (row: number, col: number) => {
      if (state.status !== 'running') return;
      if (board[row][col] !== null) return;

      const current = state.currentPlayer as 0 | 1;
      const mode = playerConfigs[current]?.mode ?? 'human';
      if (mode !== 'human') return;

      applyAction({ row, col }, 'human');
    },
    [applyAction, board, playerConfigs, state]
  );

  const handleStart = useCallback(() => {
    setState(gobangEngine.initialState());
    setMoveLog([]);
    setAiStatus(null);
    setAiError(null);
    lastRecordedTurnRef.current = null;
    setLastLatency([null, null]);
  }, []);

  const handleReset = useCallback(() => {
    setState(gobangEngine.initialState());
    setMoveLog([]);
    setAiStatus(null);
    setAiError(null);
    lastRecordedTurnRef.current = null;
    setLastLatency([null, null]);
  }, []);

  const handleResign = useCallback(() => {
    if (state.status !== 'running') return;

    const resigning = state.currentPlayer as 0 | 1;
    const winner = ((resigning + 1) % gobangEngine.maxPlayers) as 0 | 1;

    setState((previous) => ({
      ...previous,
      status: 'finished',
      data: {
        ...previous.data,
        winner,
      },
    }));

    setMoveLog((history) => [
      ...history,
      {
        turn: state.turn + 1,
        player: resigning,
        row: null,
        col: null,
        coordinate: 'Resign',
        origin: 'resign',
      },
    ]);
    setAiStatus(null);
  }, [state]);

  const recordLatency = useCallback(
    (playerIndex: 0 | 1, durationMs: number) => {
      if (!Number.isFinite(durationMs) || durationMs < 0) return;
      const identity = buildPlayerIdentity(playerConfigs[playerIndex] ?? { mode: 'human' }, playerIndex);
      const baseStore = ensureLatencyStore(
        latencyStoreRef.current || { schema: LATENCY_SCHEMA, players: {} },
        LATENCY_SCHEMA,
      );
      const nextPlayers = { ...(baseStore.players || {}) };
      nextPlayers[identity.id] = updateLatencyStats(nextPlayers[identity.id], durationMs, identity.label);
      const nextStore: LatencyStore = {
        schema: LATENCY_SCHEMA,
        updatedAt: new Date().toISOString(),
        players: nextPlayers,
      };
      const persisted = writeLatencyStore(LATENCY_KEY, nextStore);
      latencyStoreRef.current = persisted;
      setLatencyStore(persisted);
      setLastLatency((prev) => {
        const arr = Array.isArray(prev) ? [...prev] : [null, null];
        arr[playerIndex] = durationMs;
        return arr;
      });
    },
    [playerConfigs],
  );

  const handleTsExport = useCallback(() => {
    const store = ensureTsStore();
    const blob = new Blob([JSON.stringify(store, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = formatTrueSkillArchiveName('gobang_trueskill');
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [ensureTsStore]);

  const handleTsUpload = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const store = importTrueSkillArchive(text, TS_SCHEMA);
        tsStoreRef.current = store;
        writeTrueSkillStore(TS_STORE_KEY, store);
        applyStoredRatings();
      } catch (error: any) {
        setAiError(error?.message || 'TrueSkill 存档导入失败');
      } finally {
        event.target.value = '';
      }
    },
    [applyStoredRatings],
  );

  const updatePlayerConfig = useCallback((index: 0 | 1, update: Partial<PlayerConfig>) => {
    setPlayerConfigs((previous) => {
      const next = [...previous] as PlayerConfig[];
      const current = sanitizePlayerConfig(next[index]);
      next[index] = sanitizePlayerConfig({ ...current, ...update });
      return next;
    });
  }, []);

  const requestExternalMove = useCallback(
    async (
      mode: PlayerMode,
      config: PlayerConfig,
      observation: string,
      legalMovesInput: GobangAction[],
      playerIndex: 0 | 1
    ): Promise<{ action: GobangAction; note?: string }> => {
      const legalMoves = legalMovesInput.map((move) => ({ row: move.row, col: move.col }));
      const response = await fetch('/api/gobang/move', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          provider: mode,
          apiKey: config.apiKey,
          model: config.model,
          baseUrl: config.baseUrl,
          token: config.token,
          observation,
          legalMoves,
          player: playerIndex,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || '外置 AI 请求失败');
      }

      const data: { move?: GobangAction; reason?: string; provider?: string } = await response.json();
      if (!data.move) {
        throw new Error('外置 AI 未返回有效落点');
      }

      const note = data.reason
        ? data.provider
          ? `${data.provider}：${data.reason}`
          : data.reason
        : data.provider;

      return { action: data.move, note: note || undefined };
    },
    []
  );

  const requiresApiKey = useCallback((mode: PlayerMode) => mode.startsWith('ai:'), []);

  useEffect(() => {
    if (state.status !== 'running') {
      setAiStatus(null);
      setAiError(null);
      return;
    }

    const currentPlayer = state.currentPlayer as 0 | 1;
    const config = playerConfigs[currentPlayer] ?? { mode: 'human' };
    const mode = config.mode;
    if (mode === 'human') {
      setAiStatus(null);
      return;
    }

    const legal = gobangEngine.legalActions(state);
    if (legal.length === 0) {
      setAiStatus(null);
      return;
    }

    const ticket = aiTicketRef.current + 1;
    aiTicketRef.current = ticket;

    const runAi = async () => {
      const modeLabel = MODE_LABEL[mode] ?? 'AI';
      setAiStatus(`${PLAYERS[currentPlayer].name}（${modeLabel}）正在思考…`);
      setAiError(null);
      const startMark = typeof performance !== 'undefined' ? performance.now() : Date.now();

      try {
        if (mode === 'builtin:random') {
          const result = pickBuiltinMove(state, legal);
          if (aiTicketRef.current !== ticket) return;
          setAiStatus(null);
          const elapsed = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startMark;
          recordLatency(currentPlayer, elapsed);
          applyAction(result.action, 'ai', result.note);
          return;
        }

        if (requiresApiKey(mode) && !config.apiKey) {
          const fallback = pickBuiltinMove(state, legal);
          if (aiTicketRef.current !== ticket) return;
          setAiStatus(null);
          setAiError(`${PLAYERS[currentPlayer].name} (${modeLabel}) 未配置 API Key，已使用内置随机 AI。`);
          const combinedNote = ['未配置 API Key，改用内置随机 AI。', fallback.note].filter(Boolean).join(' ');
          const elapsed = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startMark;
          recordLatency(currentPlayer, elapsed);
          applyAction(fallback.action, 'ai', combinedNote || undefined);
          return;
        }

        const observation = gobangEngine.encodeState(state, currentPlayer);
        const result = await requestExternalMove(mode, config, observation, legal, currentPlayer);
        if (aiTicketRef.current !== ticket) return;
        setAiStatus(null);
        const elapsed = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startMark;
        recordLatency(currentPlayer, elapsed);
        applyAction(result.action, 'ai', result.note);
      } catch (error) {
        if (aiTicketRef.current !== ticket) return;
        console.error(error);
        const fallback = pickBuiltinMove(state, legal);
        setAiStatus(null);
        const message = error instanceof Error ? error.message : String(error);
        setAiError(message || '外置 AI 调用失败，已回退到内置随机 AI。');
        const combinedNote = ['外置 AI 调用失败，已使用内置随机 AI。', fallback.note].filter(Boolean).join(' ');
        const elapsed = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startMark;
        recordLatency(currentPlayer, elapsed);
        applyAction(fallback.action, 'ai', combinedNote || undefined);
      }
    };

    const timer = window.setTimeout(() => {
      void runAi();
    }, 300);

    return () => {
      window.clearTimeout(timer);
    };
  }, [applyAction, playerConfigs, recordLatency, requestExternalMove, requiresApiKey, state]);

  const renderExternalConfig = useCallback(
    (index: 0 | 1) => {
      const config = playerConfigs[index] ?? { mode: 'human' };
      switch (config.mode) {
        case 'ai:openai':
          return (
            <div className={styles.configGroup}>
              <label className={styles.configLabel}>
                OpenAI API Key
                <input
                  type="password"
                  value={config.apiKey ?? ''}
                  onChange={(event) => updatePlayerConfig(index, { apiKey: event.target.value })}
                  className={styles.configInput}
                  placeholder="sk-..."
                  autoComplete="off"
                />
              </label>
              <label className={styles.configLabel}>
                模型（可选）
                <input
                  type="text"
                  value={config.model ?? ''}
                  onChange={(event) => updatePlayerConfig(index, { model: event.target.value })}
                  className={styles.configInput}
                  placeholder="gpt-4o-mini"
                />
                <span className={styles.configHelp}>留空使用推荐模型 gpt-4o-mini。</span>
              </label>
            </div>
          );
        case 'ai:deepseek':
          return (
            <div className={styles.configGroup}>
              <label className={styles.configLabel}>
                DeepSeek API Key
                <input
                  type="password"
                  value={config.apiKey ?? ''}
                  onChange={(event) => updatePlayerConfig(index, { apiKey: event.target.value })}
                  className={styles.configInput}
                  placeholder="sk-..."
                  autoComplete="off"
                />
              </label>
              <label className={styles.configLabel}>
                模型（可选）
                <input
                  type="text"
                  value={config.model ?? ''}
                  onChange={(event) => updatePlayerConfig(index, { model: event.target.value })}
                  className={styles.configInput}
                  placeholder="deepseek-chat"
                />
                <span className={styles.configHelp}>留空使用推荐模型 deepseek-chat。</span>
              </label>
            </div>
          );
        case 'ai:kimi':
          return (
            <div className={styles.configGroup}>
              <label className={styles.configLabel}>
                Kimi API Key
                <input
                  type="password"
                  value={config.apiKey ?? ''}
                  onChange={(event) => updatePlayerConfig(index, { apiKey: event.target.value })}
                  className={styles.configInput}
                  placeholder="sk-..."
                  autoComplete="off"
                />
              </label>
              <label className={styles.configLabel}>
                模型（可选）
                <input
                  type="text"
                  value={config.model ?? ''}
                  onChange={(event) => updatePlayerConfig(index, { model: event.target.value })}
                  className={styles.configInput}
                  placeholder="moonshot-v1-8k"
                />
                <span className={styles.configHelp}>留空使用推荐模型 moonshot-v1-8k。</span>
              </label>
              <label className={styles.configLabel}>
                API 基础地址（可选）
                <input
                  type="text"
                  value={config.baseUrl ?? ''}
                  onChange={(event) => updatePlayerConfig(index, { baseUrl: event.target.value })}
                  className={styles.configInput}
                  placeholder="https://api.moonshot.cn"
                />
                <span className={styles.configHelp}>如使用代理，可在此处覆盖默认地址。</span>
              </label>
            </div>
          );
        case 'ai:qwen':
          return (
            <div className={styles.configGroup}>
              <label className={styles.configLabel}>
                Qwen API Key
                <input
                  type="password"
                  value={config.apiKey ?? ''}
                  onChange={(event) => updatePlayerConfig(index, { apiKey: event.target.value })}
                  className={styles.configInput}
                  placeholder="sk-..."
                  autoComplete="off"
                />
              </label>
              <label className={styles.configLabel}>
                模型（可选）
                <input
                  type="text"
                  value={config.model ?? ''}
                  onChange={(event) => updatePlayerConfig(index, { model: event.target.value })}
                  className={styles.configInput}
                  placeholder="qwen-plus"
                />
                <span className={styles.configHelp}>留空使用推荐模型 qwen-plus。</span>
              </label>
            </div>
          );
        default:
          return null;
      }
    },
    [playerConfigs, updatePlayerConfig]
  );

  return (
    <div className={styles.root}>
      <section className={styles.headerCard}>
        <div className={styles.playerRow}>
          <div className={styles.playerCards}>
            <div className={styles.playerCard}>
              <div className={`${styles.avatar} ${styles.avatarRed}`}>{PLAYERS[0].avatar}</div>
              <div className={styles.playerMeta}>
                <div className={styles.playerHeader}>
                  <span>{PLAYERS[0].name}</span>
                  <span>{PLAYERS[0].flag}</span>
                </div>
                <div className={styles.playerStats}>
                  <span>{formatTrueSkillStat(tsRatings[0])}</span>
                  <span className={styles.confidence}>{formatConfidence(tsRatings[0])}</span>
                  <span className={styles.badge}>先手</span>
                </div>
                <select
                  aria-label="Player 1 mode"
                  value={playerConfigs[0]?.mode ?? 'human'}
                  onChange={(event) => {
                    const mode = event.target.value as PlayerMode;
                    updatePlayerConfig(0, { mode });
                  }}
                  className={styles.modeSelect}
                >
                  {MODE_GROUPS.map((group) => (
                    <optgroup key={group.label} label={group.label}>
                      {group.options.map((option) => (
                        <option key={option.value} value={option.value} disabled={option.disabled}>
                          {option.label}
                          {option.disabled ? '（即将上线）' : ''}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                {renderExternalConfig(0)}
              </div>
            </div>

            <div className={styles.playerCard}>
              <div className={`${styles.avatar} ${styles.avatarGreen}`}>{PLAYERS[1].avatar}</div>
              <div className={styles.playerMeta}>
                <div className={styles.playerHeader}>
                  <span>{PLAYERS[1].name}</span>
                  <span>{PLAYERS[1].flag}</span>
                </div>
                <div className={styles.playerStats}>
                  <span>{formatTrueSkillStat(tsRatings[1])}</span>
                  <span className={styles.confidence}>{formatConfidence(tsRatings[1])}</span>
                  <span className={styles.badge}>后手</span>
                </div>
                <select
                  aria-label="Player 2 mode"
                  value={playerConfigs[1]?.mode ?? 'builtin:random'}
                  onChange={(event) => {
                    const mode = event.target.value as PlayerMode;
                    updatePlayerConfig(1, { mode });
                  }}
                  className={styles.modeSelect}
                >
                  {MODE_GROUPS.map((group) => (
                    <optgroup key={group.label} label={group.label}>
                      {group.options.map((option) => (
                        <option key={option.value} value={option.value} disabled={option.disabled}>
                          {option.label}
                          {option.disabled ? '（即将上线）' : ''}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                {renderExternalConfig(1)}
              </div>
            </div>
          </div>

          <div className={styles.matchBadge}>
            <div className={styles.badge}>Match</div>
            <div className={styles.matchTitle}>Gobang</div>
            <p className={styles.matchStatus}>{matchStatus}</p>
          </div>
        </div>
      </section>

      <div className={styles.main}>
        <div className={styles.boardColumn}>
          <div className={styles.boardWrapper}>
            <div className={styles.boardContainer}>
              <div className={styles.boardSurface}>
                <div className={styles.boardFrame} />
                <svg className={styles.boardGrid} viewBox={`-0.5 -0.5 ${BOARD_SIZE} ${BOARD_SIZE}`} preserveAspectRatio="none">
                  <defs>
                    <radialGradient id={BOARD_GRADIENT_ID} cx="50%" cy="50%" r="75%">
                      <stop offset="0%" stopColor="rgba(30, 41, 59, 0.65)" />
                      <stop offset="45%" stopColor="rgba(15, 23, 42, 0.35)" />
                      <stop offset="100%" stopColor="rgba(2, 6, 23, 0.1)" />
                    </radialGradient>
                  </defs>
                  <rect x={-0.5} y={-0.5} width={BOARD_SIZE} height={BOARD_SIZE} fill={`url(#${BOARD_GRADIENT_ID})`} />
                  {Array.from({ length: BOARD_SIZE }).map((_, index) => {
                    const offset = index;
                    return (
                      <g key={index}>
                        <line x1={offset} y1={0} x2={offset} y2={BOARD_SIZE - 1} stroke={BOARD_LINE_COLOR} strokeWidth={0.04} />
                        <line x1={0} y1={offset} x2={BOARD_SIZE - 1} y2={offset} stroke={BOARD_LINE_COLOR} strokeWidth={0.04} />
                      </g>
                    );
                  })}
                  {STAR_POINTS.map((point) => (
                    <circle
                      key={`${point.row}-${point.col}`}
                      cx={point.col}
                      cy={point.row}
                      r={0.18}
                      fill={BOARD_STAR_COLOR}
                      opacity={0.9}
                    />
                  ))}
                </svg>
                <div className={styles.boardIntersections}>
                  <div className={styles.boardIntersectionsInner}>
                    {board.map((row, rowIndex) =>
                      row.map((cell, colIndex) => {
                        const isLastMove = !!lastMove && lastMove.row === rowIndex && lastMove.col === colIndex;
                        const isHumanTurn =
                          state.status === 'running' && (playerConfigs[state.currentPlayer as 0 | 1]?.mode ?? 'human') === 'human';
                        const disabled = !isHumanTurn;
                        const left = ((colIndex + 0.5) / BOARD_SIZE) * 100;
                        const top = ((rowIndex + 0.5) / BOARD_SIZE) * 100;
                        const intersectionStyle = {
                          left: `${left}%`,
                          top: `${top}%`,
                          width: INTERSECTION_HIT_SIZE,
                          height: INTERSECTION_HIT_SIZE,
                        } as const;

                        return (
                          <div key={`${rowIndex}-${colIndex}`} className={styles.intersection} style={intersectionStyle}>
                            {cell !== null ? (
                              <>
                                <span
                                  className={styles.stone}
                                  style={{
                                    width: STONE_SIZE,
                                    height: STONE_SIZE,
                                    background: PLAYERS[cell].stoneFill,
                                    boxShadow: PLAYERS[cell].shadow,
                                  }}
                                />
                                {isLastMove ? (
                                  <span
                                    className={styles.lastMoveRing}
                                    style={{ width: LAST_MOVE_RING_SIZE, height: LAST_MOVE_RING_SIZE }}
                                  />
                                ) : null}
                              </>
                            ) : (
                              <button
                                type="button"
                                aria-label={`Place stone at ${formatCoordinate(rowIndex, colIndex)}`}
                                onClick={() => handleCellClick(rowIndex, colIndex)}
                                disabled={disabled}
                                className={disabled ? styles.boardCell : `${styles.boardCell} ${styles.boardCellEnabled}`}
                                style={{ width: '100%', height: '100%' }}
                              >
                                <span
                                  className={styles.guideDot}
                                  style={{
                                    width: GUIDE_DOT_SIZE,
                                    height: GUIDE_DOT_SIZE,
                                    background: disabled ? 'transparent' : 'rgba(255,255,255,0.08)',
                                  }}
                                />
                              </button>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
                {state.status === 'pending' ? (
                  <div className={styles.pendingOverlay}>
                    <div className={styles.pendingOverlayContent}>点击“开始对局”以启动比赛</div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className={styles.controls}>
            <div className={styles.controlStat}>
              <span className={styles.badge}>合法落点</span>
              <span className={styles.statBadge}>{legalMoves.length}</span>
            </div>
            <div className={styles.controlStat}>
              {hasStarted ? (
                <>
                  <button type="button" onClick={handleReset} className={styles.buttonSecondary}>
                    重新开始
                  </button>
                  <button
                    type="button"
                    onClick={handleResign}
                    disabled={state.status !== 'running'}
                    className={styles.buttonDanger}
                  >
                    认输
                  </button>
                </>
              ) : (
                <button type="button" onClick={handleStart} className={styles.buttonPrimary}>
                  开始对局
                </button>
              )}
            </div>
            <div className={styles.controlMessages}>
              {aiStatus ? <div className={styles.statusBanner}>{aiStatus}</div> : null}
              {aiError ? <div className={styles.errorBanner}>{aiError}</div> : null}
            </div>
          </div>
        </div>

        <aside className={styles.sidebar}>
          <div className={styles.infoCard}>
            <h3 className={styles.infoTitle}>对局信息</h3>
            <dl className={styles.infoList}>
              <div className={styles.infoRow}>
                <dt className={styles.infoLabel}>当前回合</dt>
                <dd>{state.turn}</dd>
              </div>
              <div className={styles.infoRow}>
                <dt className={styles.infoLabel}>轮到</dt>
                <dd>{state.status === 'running' ? PLAYERS[state.currentPlayer as 0 | 1].name : '—'}</dd>
              </div>
              <div className={styles.infoRow}>
                <dt className={styles.infoLabel}>状态</dt>
                <dd>{matchStatus}</dd>
              </div>
              <div className={styles.infoRow}>
                <dt className={styles.infoLabel}>AI 模式</dt>
                <dd>
                  {playerConfigs
                    .map((config, index) => {
                      const mode = config?.mode ?? 'human';
                      return `${PLAYERS[index].name}: ${MODE_LABEL[mode] ?? mode}`;
                    })
                    .join(' | ')}
                </dd>
              </div>
            </dl>
          </div>

          <div className={styles.logCard}>
            <h3 className={styles.logTitle}>落子记录</h3>
            {moveLog.length === 0 ? (
              <p className={styles.logEmpty}>尚未开始，请点击上方的“开始对局”按钮。</p>
            ) : (
              <ol className={styles.logList}>
                {moveLog.map((entry, index) => {
                  const player = PLAYERS[entry.player];
                  const badgeClass = entry.player === 0 ? styles.logBadgeRed : styles.logBadgeGreen;
                  const label = entry.origin === 'resign' ? '认输' : entry.coordinate;
                  const originLabel = entry.origin === 'ai' ? 'AI' : entry.origin === 'human' ? '人类' : '系统';

                  return (
                    <li key={`${entry.turn}-${index}`} className={styles.logItem}>
                      <div className={styles.logItemHeader}>
                        <div className={styles.controlStat}>
                          <span className={`${styles.logItemBadge} ${badgeClass}`}>{player.name}</span>
                          <span className={styles.badge}>T{String(entry.turn).padStart(2, '0')}</span>
                        </div>
                        <div className={styles.logMeta}>
                          <span className={styles.logCoordinate}>{label}</span>
                          <span className={styles.logOrigin}>{originLabel}</span>
                        </div>
                      </div>
                      {entry.note ? <div className={styles.logReason}>{entry.note}</div> : null}
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </aside>
      </div>

      <section className={styles.metricsRow}>
        <div className={styles.metricsCard}>
          <div className={styles.metricsHeader}>
            <h3>TrueSkill 存档</h3>
            <p>按当前身份读取/更新 TrueSkill，并可导入导出存档。</p>
          </div>
          <div className={styles.metricsActions}>
            <button type="button" onClick={applyStoredRatings} className={styles.tsButton}>
              应用存档
            </button>
            <button type="button" onClick={handleTsExport} className={styles.tsButton}>
              导出
            </button>
            <label className={styles.uploadLabel}>
              导入
              <input
                ref={tsFileRef}
                type="file"
                accept="application/json"
                onChange={handleTsUpload}
                className={styles.uploadInput}
              />
            </label>
          </div>
        </div>
        <div className={styles.metricsCard}>
          <div className={styles.metricsHeader}>
            <h3>思考耗时</h3>
            <p>记录每位选手的平均思考时间与最近一次耗时。</p>
          </div>
          <table className={styles.latencyTable}>
            <thead>
              <tr>
                <th>身份</th>
                <th>平均 (ms)</th>
                <th>次数</th>
                <th>最近 (ms)</th>
              </tr>
            </thead>
            <tbody>
              {[0, 1].map((index) => {
                const identity = buildPlayerIdentity(playerConfigs[index] ?? { mode: 'human' }, index);
                const stats = latencyStore.players?.[identity.id];
                const last = lastLatency[index];
                return (
                  <tr key={identity.id}>
                    <td>{identity.label}</td>
                    <td>{stats ? stats.mean.toFixed(1) : '—'}</td>
                    <td>{stats ? stats.count : '—'}</td>
                    <td>{last != null ? last.toFixed(1) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
