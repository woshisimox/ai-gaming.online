'use client';

import { useEffect, useMemo, useState } from 'react';

import { readDdzLadderPlayers, type DdzLadderPlayer } from '../../lib/game-modules/ddzLadder';
import { readLatencyStore, type LatencyStore } from '../../lib/game-modules/latencyStore';
import styles from './DdzLadderCard.module.css';

const LATENCY_KEY = 'ddz_latency_store_v1';
const LATENCY_SCHEMA = 'ddz-latency@3';

type Lang = 'zh' | 'en';

const TEXT: Record<Lang, {
  scoreTitle: string;
  scoreDesc: string;
  matchesTitle: string;
  matchesDesc: string;
  matchesUnit: string;
  latencyTitle: string;
  latencyDesc: string;
  latencySampleLabel: string;
  latencyEmpty: string;
  empty: string;
}> = {
  zh: {
    scoreTitle: '积分',
    scoreDesc: '实时 ΔR 变化，灰色竖线表示 0 分。',
    matchesTitle: '累计局数',
    matchesDesc: '按参赛次数排序，蓝色柱条越长代表局数越多。',
    matchesUnit: '局',
    latencyTitle: '思考耗时统计',
    latencyDesc: '按平均耗时从快到慢排列，灰色文本表示样本量。',
    latencySampleLabel: '样本',
    latencyEmpty: '暂无耗时样本，完成一局后即可自动生成统计。',
    empty: '暂无积分数据，开始一场斗地主对局后会自动记录。',
  },
  en: {
    scoreTitle: 'Score ΔR',
    scoreDesc: 'Live ΔR swings; the gray divider marks zero.',
    matchesTitle: 'Total Games',
    matchesDesc: 'Sorted by participation count; longer bars mean more games played.',
    matchesUnit: 'games',
    latencyTitle: 'Thinking Latency',
    latencyDesc: 'Fastest to slowest average decision time. Gray text shows sample size.',
    latencySampleLabel: 'Samples',
    latencyEmpty: 'No latency samples yet—finish a round to populate this view.',
    empty: 'No rating data yet. Play a Dou Dizhu match to start tracking.',
  },
};

const LOCALES: Record<Lang, string> = {
  zh: 'zh-CN',
  en: 'en-US',
};

export default function DdzLadderCard({ refreshToken, lang }: { refreshToken: number; lang: Lang }) {
  const [players, setPlayers] = useState<DdzLadderPlayer[]>(() => readDdzLadderPlayers());
  const [latencyStore, setLatencyStore] = useState<LatencyStore>(() => readLatencyStore(LATENCY_KEY, LATENCY_SCHEMA));
  const copy = TEXT[lang];
  const locale = LOCALES[lang];
  const numberFormatter = useMemo(() => new Intl.NumberFormat(locale), [locale]);

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
    return <div className={styles.empty}>{copy.empty}</div>;
  }

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <h4 className={styles.headerTitle}>{copy.scoreTitle}</h4>
        <p className={styles.headerText}>{copy.scoreDesc}</p>
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
        <h4 className={styles.segmentTitle}>{copy.matchesTitle}</h4>
        <p className={styles.segmentDesc}>{copy.matchesDesc}</p>
        <div className={`${styles.grid} ${styles.gridMatches}`}>
          {byMatches.map((player) => {
            const pct = Math.min(1, (player.matches || 0) / (maxMatches || 1));
            return (
              <div key={`matches-${player.id}`} className={styles.row}>
                <div className={styles.label}>{player.label}</div>
                <div className={styles.matchTrack}>
                  <div className={styles.matchFill} style={{ width: `${pct * 100}%` }} />
                </div>
                <div className={styles.value}>
                  {numberFormatter.format(Math.round(player.matches))} {copy.matchesUnit}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className={styles.segment}>
        <h4 className={styles.segmentTitle}>{copy.latencyTitle}</h4>
        <p className={styles.segmentDesc}>{copy.latencyDesc}</p>
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
                    <span className={styles.latencySamples}>
                      {copy.latencySampleLabel} {numberFormatter.format(entry.count)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className={styles.segmentEmpty}>{copy.latencyEmpty}</p>
        )}
      </div>
    </div>
  );
}
