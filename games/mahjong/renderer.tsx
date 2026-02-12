import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PlayerConfigPanel } from '../../components/game-modules/PlayerConfigPanel';
import { readPlayerConfigs, writePlayerConfigs } from '../../lib/game-modules/playerConfigStore';
import { mahjongEngine, type MahjongAction, type MahjongState, type Tile } from './game';
import styles from './renderer.module.css';

const SEAT_LABELS = ['东', '南', '西', '北'];
const SEAT_CLASS = [styles.seatEast, styles.seatSouth, styles.seatWest, styles.seatNorth];

type PlayerMode = 'human' | 'builtin:heuristic' | 'ai:openai' | 'ai:deepseek' | 'ai:kimi' | 'ai:qwen';

interface PlayerConfig {
  mode: PlayerMode;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
}

const MODE_LABEL: Record<PlayerMode, string> = {
  human: '人类选手',
  'builtin:heuristic': '内置算法：启发式',
  'ai:openai': '外置 AI：OpenAI',
  'ai:deepseek': '外置 AI：DeepSeek',
  'ai:kimi': '外置 AI：Kimi',
  'ai:qwen': '外置 AI：Qwen',
};

const MODE_GROUPS = [
  { label: '人类', options: [{ value: 'human', label: '人类选手' }] },
  { label: '内置算法', options: [{ value: 'builtin:heuristic', label: '启发式（优先保留对子）' }] },
  {
    label: '外置 AI',
    options: [
      { value: 'ai:openai', label: 'OpenAI' },
      { value: 'ai:deepseek', label: 'DeepSeek' },
      { value: 'ai:kimi', label: 'Kimi' },
      { value: 'ai:qwen', label: 'Qwen' },
    ],
  },
];

const PLAYER_STORAGE_KEY = 'mahjong_player_configs_v1';

function sanitizePlayerConfig(raw?: PlayerConfig): PlayerConfig {
  if (!raw || typeof raw !== 'object') return { mode: 'human' };
  const mode = raw.mode && MODE_LABEL[raw.mode] ? raw.mode : 'human';
  return {
    mode,
    model: raw.model || '',
    apiKey: raw.apiKey || '',
    baseUrl: raw.baseUrl || '',
  };
}

function formatTile(tile: Tile): string {
  const map: Record<string, string> = {
    E: '东',
    S: '南',
    W: '西',
    N: '北',
    C: '中',
    F: '发',
    P: '白',
    m: '万',
    p: '筒',
    s: '条',
  };
  if (tile.length === 1) return map[tile];
  return `${tile[0]}${map[tile[1]]}`;
}

function seatDiscards(state: MahjongState, seat: number): Tile[] {
  return state.data.history
    .filter((event): event is { seat: number; type: 'discard'; tile: Tile } => event.type === 'discard' && event.seat === seat)
    .map((event) => event.tile);
}

function buildAiObservation(state: MahjongState, seat: number): string {
  const ownHand = state.data.hands[seat] ?? [];
  const lines: string[] = [
    'game:mahjong',
    `seat:${seat}(${SEAT_LABELS[seat]})`,
    `turn:${state.turn}`,
    `current:${state.currentPlayer}(${SEAT_LABELS[state.currentPlayer]})`,
    `wall:${state.data.wall.length}`,
    `ownHand:${ownHand.join(' ')}`,
    'discardsBySeat:',
  ];
  for (let i = 0; i < state.data.hands.length; i += 1) {
    lines.push(`- seat${i}(${SEAT_LABELS[i]}): ${seatDiscards(state, i).join(' ') || 'none'}`);
  }
  lines.push('recentHistory:');
  state.data.history.slice(-30).forEach((event) => {
    lines.push(event.type === 'win' ? `seat${event.seat}:win` : `seat${event.seat}:discard ${event.tile}`);
  });
  return lines.join('\n');
}

function pickBuiltinAction(state: MahjongState, legalActions: MahjongAction[]): MahjongAction {
  const win = legalActions.find((action) => action.type === 'win');
  if (win) return win;
  const hand = state.data.hands[state.currentPlayer] ?? [];
  const counts = new Map<Tile, number>();
  hand.forEach((tile) => counts.set(tile, (counts.get(tile) || 0) + 1));
  const discardCandidates = legalActions.filter((action): action is { type: 'discard'; tile: Tile } => action.type === 'discard');
  discardCandidates.sort((a, b) => {
    const ca = counts.get(a.tile) || 0;
    const cb = counts.get(b.tile) || 0;
    if (ca !== cb) return ca - cb;
    return a.tile.localeCompare(b.tile);
  });
  return discardCandidates[0] ?? legalActions[0];
}

async function requestExternalAction(
  mode: PlayerMode,
  config: PlayerConfig,
  observation: string,
  legalActions: MahjongAction[],
  player: number,
): Promise<{ action: MahjongAction; note?: string }> {
  const response = await fetch('/api/mahjong/move', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      provider: mode,
      apiKey: config.apiKey,
      model: config.model,
      baseUrl: config.baseUrl,
      observation,
      legalActions,
      player,
    }),
  });

  if (!response.ok) {
    throw new Error((await response.text()) || '外置 AI 请求失败');
  }

  const payload: { action?: MahjongAction; reason?: string; provider?: string } = await response.json();
  if (!payload.action) throw new Error('外置 AI 未返回动作');
  const note = payload.reason ? `${payload.provider || 'AI'}：${payload.reason}` : payload.provider;
  return { action: payload.action, note };
}

export default function MahjongRenderer() {
  const [state, setState] = useState<MahjongState>(() => mahjongEngine.initialState());
  const [playerConfigs, setPlayerConfigs] = useState<PlayerConfig[]>(() =>
    readPlayerConfigs<PlayerConfig>(
      PLAYER_STORAGE_KEY,
      () => [{ mode: 'human' }, { mode: 'human' }, { mode: 'human' }, { mode: 'human' }],
      sanitizePlayerConfig,
    ),
  );
  const [aiStatus, setAiStatus] = useState<string>('');
  const [aiError, setAiError] = useState<string>('');
  const aiTicketRef = useRef(0);

  const legal = useMemo(() => mahjongEngine.legalActions(state), [state]);
  const canWin = legal.some((action) => action.type === 'win');
  const discardables = legal
    .filter((action): action is { type: 'discard'; tile: Tile } => action.type === 'discard')
    .map((action) => action.tile);

  useEffect(() => {
    writePlayerConfigs(PLAYER_STORAGE_KEY, playerConfigs, sanitizePlayerConfig);
  }, [playerConfigs]);

  const applyAction = useCallback((action: MahjongAction) => {
    setState((prev) => mahjongEngine.nextState(prev, action));
  }, []);

  useEffect(() => {
    if (state.status !== 'running') {
      setAiStatus('');
      setAiError('');
      return;
    }

    const seat = state.currentPlayer;
    const cfg = playerConfigs[seat] ?? { mode: 'human' };
    if (cfg.mode === 'human') {
      setAiStatus('');
      return;
    }

    const legalActions = mahjongEngine.legalActions(state);
    if (!legalActions.length) return;

    const ticket = aiTicketRef.current + 1;
    aiTicketRef.current = ticket;

    const run = async () => {
      try {
        setAiError('');
        setAiStatus(`${SEAT_LABELS[seat]}家（${MODE_LABEL[cfg.mode]}）思考中…`);

        const observation = buildAiObservation(state, seat);
        let result: { action: MahjongAction; note?: string };

        if (cfg.mode === 'builtin:heuristic') {
          result = { action: pickBuiltinAction(state, legalActions), note: '已传入手牌、弃牌与回合信息到内置算法。' };
        } else {
          if (!cfg.apiKey || !cfg.model) {
            result = { action: pickBuiltinAction(state, legalActions), note: '外置 AI 缺少 API Key/模型，改用内置算法。' };
          } else {
            result = await requestExternalAction(cfg.mode, cfg, observation, legalActions, seat);
          }
        }

        if (aiTicketRef.current !== ticket) return;
        setAiStatus(result.note || 'AI 已出牌');
        applyAction(result.action);
      } catch (error: any) {
        if (aiTicketRef.current !== ticket) return;
        setAiStatus('');
        setAiError(error?.message || 'AI 调用失败，已回退内置算法。');
        applyAction(pickBuiltinAction(state, legalActions));
      }
    };

    const timer = window.setTimeout(() => {
      void run();
    }, 350);

    return () => window.clearTimeout(timer);
  }, [applyAction, playerConfigs, state]);

  const updatePlayerConfig = useCallback((index: number, update: Partial<PlayerConfig>) => {
    setPlayerConfigs((previous) => {
      const next = [...previous];
      next[index] = sanitizePlayerConfig({ ...sanitizePlayerConfig(next[index]), ...update });
      return next;
    });
  }, []);

  const renderConfigFields = useCallback(
    (index: number) => {
      const cfg = playerConfigs[index] ?? { mode: 'human' };
      if (cfg.mode === 'human' || cfg.mode === 'builtin:heuristic') return null;
      return (
        <div className="grid gap-2">
          <label className="text-xs text-slate-500">
            模型名
            <input
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
              value={cfg.model || ''}
              onChange={(event) => updatePlayerConfig(index, { model: event.target.value })}
              placeholder="如：gpt-4o-mini"
            />
          </label>
          <label className="text-xs text-slate-500">
            API Key
            <input
              type="password"
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
              value={cfg.apiKey || ''}
              onChange={(event) => updatePlayerConfig(index, { apiKey: event.target.value })}
              placeholder="sk-..."
            />
          </label>
          <label className="text-xs text-slate-500">
            Base URL（可选）
            <input
              className="mt-1 w-full rounded border border-slate-300 px-2 py-1 text-sm"
              value={cfg.baseUrl || ''}
              onChange={(event) => updatePlayerConfig(index, { baseUrl: event.target.value })}
              placeholder="https://api.openai.com"
            />
          </label>
        </div>
      );
    },
    [playerConfigs, updatePlayerConfig],
  );

  return (
    <section className={styles.container}>
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-xl font-semibold text-slate-800">麻将（简化版）</h2>
        <p className="mt-2 text-sm text-slate-600">参考斗地主：每位参赛选手可独立设置人类、内置算法、外置AI。调用内置算法/外置AI时会传递已出牌、自己手牌、回合、牌墙等信息。</p>
        <div className="mt-3 flex flex-wrap gap-3 text-sm text-slate-700">
          <span>当前玩家：{SEAT_LABELS[state.currentPlayer]}家</span>
          <span>牌墙：{state.data.wall.length}</span>
          <span>回合：{state.turn}</span>
          <span>
            状态：
            {state.status === 'finished'
              ? state.data.winner === null
                ? '流局'
                : `${SEAT_LABELS[state.data.winner]}家胡牌`
              : '进行中'}
          </span>
        </div>
        {aiStatus ? <div className="mt-2 text-sm text-emerald-700">{aiStatus}</div> : null}
        {aiError ? <div className="mt-2 text-sm text-rose-700">{aiError}</div> : null}
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white"
            onClick={() => setState(mahjongEngine.initialState(Date.now()))}
          >
            新开一局
          </button>
          {state.status !== 'finished' && canWin ? (
            <button
              type="button"
              className="rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white"
              onClick={() => applyAction({ type: 'win' })}
            >
              胡牌
            </button>
          ) : null}
        </div>
      </div>

      <PlayerConfigPanel
        title="参赛选手配置（麻将）"
        description="每位选手可独立设置为人类、内置算法或外置AI。"
        players={SEAT_LABELS.map((seat, idx) => ({ title: `${seat}家`, badge: `Seat ${idx}` }))}
        configs={playerConfigs}
        optionGroups={MODE_GROUPS}
        getMode={(cfg) => cfg?.mode}
        onModeChange={(index, mode) => updatePlayerConfig(index, { mode: mode as PlayerMode })}
        renderFields={(index) => renderConfigFields(index)}
      />

      <div className={styles.tableBoard}>
        <div className={styles.centerInfo}>
          <div className="text-lg font-semibold">麻将桌</div>
          <div className="mt-1 text-sm">当前：{SEAT_LABELS[state.currentPlayer]}家</div>
          <div className="text-sm">牌墙：{state.data.wall.length}</div>
          <div className="mt-2 text-xs text-slate-300">四家明牌展示</div>
        </div>

        {state.data.hands.map((hand, seat) => {
          const current = seat === state.currentPlayer;
          const discards = seatDiscards(state, seat);
          const mode = playerConfigs[seat]?.mode ?? 'human';
          return (
            <article key={seat} className={`${styles.seatArea} ${SEAT_CLASS[seat]} ${current ? styles.current : ''}`}>
              <div className={styles.seatHeader}>
                <h3 className="text-sm font-semibold">{SEAT_LABELS[seat]}家</h3>
                <span className="text-[11px] text-slate-300">{MODE_LABEL[mode]}</span>
              </div>

              <div className={styles.hand}>
                {hand.map((tile, idx) => {
                  const canDiscard =
                    current &&
                    state.status !== 'finished' &&
                    mode === 'human' &&
                    discardables.includes(tile);
                  return (
                    <button
                      key={`${tile}-${idx}`}
                      type="button"
                      className={styles.tileBtn}
                      disabled={!canDiscard}
                      onClick={() => applyAction({ type: 'discard', tile })}
                    >
                      {formatTile(tile)}
                    </button>
                  );
                })}
              </div>

              <div className={styles.river}>
                {discards.length === 0 ? (
                  <span className="text-[11px] text-slate-400">暂无弃牌</span>
                ) : (
                  discards.map((tile, idx) => (
                    <span key={`${tile}-r-${idx}`} className={styles.riverTile}>
                      {formatTile(tile)}
                    </span>
                  ))
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
