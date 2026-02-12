import { useMemo, useState } from 'react';
import { mahjongEngine, type MahjongState, type Tile } from './game';
import styles from './renderer.module.css';

const SEAT_LABELS = ['东', '南', '西'];

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

export default function MahjongRenderer() {
  const [state, setState] = useState<MahjongState>(() => mahjongEngine.initialState());
  const legal = useMemo(() => mahjongEngine.legalActions(state), [state]);

  const canWin = legal.some((action) => action.type === 'win');
  const discardables = legal
    .filter((action): action is { type: 'discard'; tile: Tile } => action.type === 'discard')
    .map((action) => action.tile);

  return (
    <section className={styles.container}>
      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-xl font-semibold text-slate-800">麻将（简化版）</h2>
        <p className="mt-2 text-sm text-slate-600">布局和回合逻辑参考斗地主：3名玩家轮流出牌（打出1张），下家摸1张；满足胡牌牌型可点击“胡牌”。</p>
        <div className="mt-3 flex flex-wrap gap-3 text-sm text-slate-700">
          <span>当前玩家：{SEAT_LABELS[state.currentPlayer]}</span>
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
              onClick={() => setState((prev) => mahjongEngine.nextState(prev, { type: 'win' }))}
            >
              胡牌
            </button>
          ) : null}
        </div>
      </div>

      <div className={styles.playerGrid}>
        {state.data.hands.map((hand, seat) => (
          <article key={seat} className={`${styles.playerCard} ${seat === state.currentPlayer ? styles.current : ''}`}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-700">{SEAT_LABELS[seat]}家</h3>
              <span className="text-xs text-slate-500">手牌 {hand.length} 张</span>
            </div>
            <div className={styles.hand}>
              {hand.map((tile, idx) => {
                const canDiscard =
                  seat === state.currentPlayer &&
                  state.status !== 'finished' &&
                  discardables.includes(tile);
                return (
                  <button
                    key={`${tile}-${idx}`}
                    type="button"
                    className={styles.tileBtn}
                    disabled={!canDiscard}
                    onClick={() => setState((prev) => mahjongEngine.nextState(prev, { type: 'discard', tile }))}
                  >
                    {formatTile(tile)}
                  </button>
                );
              })}
            </div>
          </article>
        ))}
      </div>

      <div className={styles.history}>
        <h3 className="font-semibold text-slate-700">出牌记录</h3>
        <ul className="mt-2 space-y-1">
          {state.data.history.length === 0 ? (
            <li className="text-slate-500">暂无记录</li>
          ) : (
            state.data.history
              .slice()
              .reverse()
              .map((event, idx) => (
                <li key={`${event.seat}-${idx}`}>
                  {event.type === 'win'
                    ? `${SEAT_LABELS[event.seat]}家：胡牌`
                    : `${SEAT_LABELS[event.seat]}家：打出 ${formatTile(event.tile)}`}
                </li>
              ))
          )}
        </ul>
      </div>
    </section>
  );
}
