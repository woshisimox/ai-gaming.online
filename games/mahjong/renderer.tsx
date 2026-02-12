import { useMemo, useState } from 'react';
import { mahjongEngine, type MahjongState, type Tile } from './game';
import styles from './renderer.module.css';

const SEAT_LABELS = ['东', '南', '西', '北'];
const SEAT_CLASS = [styles.seatEast, styles.seatSouth, styles.seatWest, styles.seatNorth];

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
        <p className="mt-2 text-sm text-slate-600">参考麻将台布局：东南西北四家围桌展示，四位选手手牌均为明牌；当前轮到谁，谁可点击自己的牌进行出牌。</p>
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
          return (
            <article key={seat} className={`${styles.seatArea} ${SEAT_CLASS[seat]} ${current ? styles.current : ''}`}>
              <div className={styles.seatHeader}>
                <h3 className="text-sm font-semibold">{SEAT_LABELS[seat]}家</h3>
                <span className="text-xs text-slate-300">手牌 {hand.length}</span>
              </div>

              <div className={styles.hand}>
                {hand.map((tile, idx) => {
                  const canDiscard = current && state.status !== 'finished' && discardables.includes(tile);
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
