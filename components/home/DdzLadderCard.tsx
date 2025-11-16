'use client';

import { useEffect, useMemo, useState } from 'react';

import styles from './DdzLadderCard.module.css';

type LadderPlayer = {
  id: string;
  label: string;
  deltaR: number;
  matches: number;
};

type LadderStore = {
  schema?: string;
  updatedAt?: string;
  players?: Record<string, { label?: string; current?: { deltaR?: number; matches?: number; n?: number } }>;
};

function readLadderStore(): LadderPlayer[] {
  if (typeof window === 'undefined') {
    return [];
  }
  try {
    const raw = window.localStorage.getItem('ddz_ladder_store_v1');
    if (!raw) return [];
    const parsed: LadderStore = JSON.parse(raw) || {};
    const players = parsed.players || {};
    return Object.keys(players).map((id) => {
      const entry = players[id] || {};
      const current = entry.current || {};
      const matchesValue = (() => {
        const direct = Number(current.matches);
        if (Number.isFinite(direct)) return Math.max(0, direct);
        const fallback = Number(current.n);
        if (Number.isFinite(fallback)) return Math.max(0, Math.round(fallback));
        return 0;
      })();
      return {
        id,
        label: entry.label || id,
        deltaR: Number(current.deltaR) || 0,
        matches: matchesValue,
      };
    });
  } catch (error) {
    console.warn('Failed to parse ddz ladder store', error);
    return [];
  }
}

export default function DdzLadderCard({ refreshToken }: { refreshToken: number }) {
  const [players, setPlayers] = useState<LadderPlayer[]>(() => readLadderStore());

  useEffect(() => {
    setPlayers(readLadderStore());
  }, [refreshToken]);

  useEffect(() => {
    if (typeof window === 'undefined') return () => undefined;
    const handler = () => setPlayers(readLadderStore());
    window.addEventListener('ddz-all-refresh', handler as any);
    const timer = window.setInterval(handler, 2500);
    return () => {
      window.removeEventListener('ddz-all-refresh', handler as any);
      window.clearInterval(timer);
    };
  }, []);

  const { byScore, byMatches, maxAbsScore, maxMatches } = useMemo(() => {
    const sorted = [...players].sort((a, b) => b.deltaR - a.deltaR);
    const matchesSorted = [...players].sort((a, b) => b.matches - a.matches);
    const maxAbs = sorted.length
      ? Math.max(
          ...sorted.map((player) => Math.abs(player.deltaR)),
          0,
        )
      : 0;
    const playsMax = matchesSorted.reduce((max, player) => Math.max(max, player.matches || 0), 0);
    return { byScore: sorted, byMatches: matchesSorted, maxAbsScore: maxAbs || 1, maxMatches: playsMax || 1 };
  }, [players]);

  if (!players.length) {
    return <div className={styles.empty}>暂无积分数据，开始一场斗地主对局后会自动记录。</div>;
  }

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h4 className={styles.headerTitle}>积分</h4>
        <p className={styles.headerText}>实时 ΔR 变化，灰色竖线表示 0 分。</p>
      </div>
      <div className={`${styles.grid} ${styles.gridScores}`}>
        {byScore.map((player) => {
          const pct = Math.min(1, Math.abs(player.deltaR) / (maxAbsScore || 1));
          const isPositive = player.deltaR >= 0;
          const widthPct = pct * 50;
          return (
            <div key={player.id} className={styles.row}>
              <div className={styles.label}>{player.label}</div>
              <div className={styles.track}>
                <div className={styles.zeroAxis} />
                <div
                  className={styles.deltaBar}
                  style={{
                    background: isPositive ? '#10b981' : '#f43f5e',
                    left: isPositive ? '50%' : `${50 - widthPct}%`,
                    right: isPositive ? `${50 - widthPct}%` : '50%',
                  }}
                />
              </div>
              <div className={styles.value}>{player.deltaR.toFixed(2)}</div>
            </div>
          );
        })}
      </div>

      <div className={styles.segment}>
        <h4 className={styles.segmentTitle}>累计局数</h4>
        <p className={styles.segmentDesc}>按参赛次数排序，蓝色柱条越长代表局数越多。</p>
        <div className={`${styles.grid} ${styles.gridMatches}`}>
          {byMatches.map((player) => {
            const pct = Math.min(1, (player.matches || 0) / (maxMatches || 1));
            return (
              <div key={`matches-${player.id}`} className={styles.row}>
                <div className={styles.label}>{player.label}</div>
                <div className={styles.matchTrack}>
                  <div className={styles.matchFill} style={{ width: `${pct * 100}%` }} />
                </div>
                <div className={styles.value}>{new Intl.NumberFormat('zh-CN').format(Math.round(player.matches))} 局</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
