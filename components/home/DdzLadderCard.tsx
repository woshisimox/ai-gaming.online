'use client';

import { useEffect, useMemo, useState } from 'react';

import { readDdzLadderPlayers, type DdzLadderPlayer } from '../../lib/game-modules/ddzLadder';
import { readLatencyStore, type LatencyStore } from '../../lib/game-modules/latencyStore';
import styles from './DdzLadderCard.module.css';

const LATENCY_KEY = 'ddz_latency_store_v1';
const LATENCY_SCHEMA = 'ddz-latency@3';

export default function DdzLadderCard({ refreshToken }: { refreshToken: number }) {
  const [players, setPlayers] = useState<DdzLadderPlayer[]>(() => readDdzLadderPlayers());
  const [latencyStore, setLatencyStore] = useState<LatencyStore>(() => readLatencyStore(LATENCY_KEY, LATENCY_SCHEMA));

  useEffect(() => {
    setPlayers(readDdzLadderPlayers());
    setLatencyStore(readLatencyStore(LATENCY_KEY, LATENCY_SCHEMA));
  }, [refreshToken]);

  useEffect(() => {
    if (typeof window === 'undefined') return () => undefined;
    const handler = () => {
      setPlayers(readDdzLadderPlayers());
      setLatencyStore(readLatencyStore(LATENCY_KEY, LATENCY_SCHEMA));
    };
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

  const latencyRows = useMemo(() => {
    const entries = Object.entries(latencyStore.players || {});
    const rows = entries
      .map(([id, stats]) => ({
        id,
        label: stats.label || id,
        mean: Number(stats.mean) || 0,
        count: Number(stats.count) || 0,
      }))
      .filter((row) => row.count > 0)
      .sort((a, b) => a.mean - b.mean);
    const maxMean = rows.reduce((max, row) => Math.max(max, row.mean), 0) || 1;
    return { rows, maxMean };
  }, [latencyStore]);

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

      <div className={styles.segment}>
        <h4 className={styles.segmentTitle}>思考耗时统计</h4>
        <p className={styles.segmentDesc}>按平均耗时从快到慢排列，灰色文本表示样本量。</p>
        {latencyRows.rows.length ? (
          <div className={`${styles.grid} ${styles.gridLatency}`}>
            {latencyRows.rows.map((entry) => {
              const pct = Math.min(1, entry.mean / (latencyRows.maxMean || 1));
              return (
                <div key={`latency-${entry.id}`} className={styles.row}>
                  <div className={styles.label}>{entry.label}</div>
                  <div className={styles.latencyTrack}>
                    <div className={styles.latencyFill} style={{ width: `${pct * 100}%` }} />
                  </div>
                  <div className={`${styles.value} ${styles.latencyValue}`}>
                    <span>{entry.mean.toFixed(1)} ms</span>
                    <span className={styles.latencySamples}>样本 {new Intl.NumberFormat('zh-CN').format(entry.count)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className={styles.segmentEmpty}>暂无耗时样本，完成一局后即可自动生成统计。</p>
        )}
      </div>
    </div>
  );
}
