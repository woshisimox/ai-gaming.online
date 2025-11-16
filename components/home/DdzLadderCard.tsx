'use client';

import { useEffect, useMemo, useState } from 'react';

import { readDdzLadderPlayers, type DdzLadderPlayer } from '../../lib/game-modules/ddzLadder';
import styles from './DdzLadderCard.module.css';

export default function DdzLadderCard({ refreshToken }: { refreshToken: number }) {
  const [players, setPlayers] = useState<DdzLadderPlayer[]>(() => readDdzLadderPlayers());

  useEffect(() => {
    setPlayers(readDdzLadderPlayers());
  }, [refreshToken]);

  useEffect(() => {
    if (typeof window === 'undefined') return () => undefined;
    const handler = () => setPlayers(readDdzLadderPlayers());
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
                  className={`${styles.deltaBar} ${isPositive ? styles.deltaBarPositive : styles.deltaBarNegative}`}
                  style={{
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
