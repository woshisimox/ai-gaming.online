'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { GameDefinition, GameId } from '../../games';
import DonationWidget from '../DonationWidget';
import DdzLadderCard from './DdzLadderCard';
import {
  readTrueSkillStore,
  resolveStoredRating,
  TS_DEFAULT,
  type TrueSkillStore,
} from '../../lib/game-modules/trueSkill';
import { readLatencyStore, type LatencyStore } from '../../lib/game-modules/latencyStore';
import { readMatchSummaryStore } from '../../lib/game-modules/matchStatsStore';
import styles from './HomeDashboard.module.css';

type Props = {
  games: GameDefinition[];
  onSelectGame: (id: GameId) => void;
};

type LadderEntry = {
  label: string;
  cr: number;
  mu: number;
  sigma: number;
};

type GameStatsSnapshot = {
  id: GameId;
  ladder: LadderEntry[];
  playerCount: number;
  totalMatches: number | null;
  matchDetail?: string;
  latencyAvg: number | null;
  latencySamples: number;
  ladderUpdatedAt?: string;
  latencyUpdatedAt?: string;
};

type MatchResolver = () => { total: number | null; detail?: string };

type StatsConfig = {
  tsKey: string;
  tsSchema: string;
  latencyKey: string;
  latencySchema: string;
  resolveMatches: MatchResolver;
};

const DDZ_MATCH_KEY = 'ddz_ladder_store_v1';
const GOBANG_MATCH_KEY = 'gobang_match_stats_v1';
const GOBANG_MATCH_SCHEMA = 'gobang-match-stats@1';

const GAME_STATS_CONFIG: Partial<Record<GameId, StatsConfig>> = {
  ddz: {
    tsKey: 'ddz_ts_store_v1',
    tsSchema: 'ddz-trueskill@1',
    latencyKey: 'ddz_latency_store_v1',
    latencySchema: 'ddz-latency@3',
    resolveMatches: () => {
      if (typeof window === 'undefined') {
        return { total: 0 };
      }
      try {
        const raw = window.localStorage.getItem(DDZ_MATCH_KEY);
        if (!raw) return { total: 0 };
        const store = JSON.parse(raw) || {};
        const players = (store?.players && typeof store.players === 'object') ? (store.players as Record<string, any>) : {};
        let total = 0;
        for (const key of Object.keys(players)) {
          const entry = players[key];
          if (!entry) continue;
          const matches = entry?.current?.matches;
          if (typeof matches === 'number' && Number.isFinite(matches)) {
            total += Math.max(0, Math.round(matches));
            continue;
          }
          const fallback = entry?.current?.n;
          if (typeof fallback === 'number' && Number.isFinite(fallback)) {
            total += Math.max(0, Math.round(fallback));
          }
        }
        return { total };
      } catch {
        return { total: 0 };
      }
    },
  },
  gobang: {
    tsKey: 'gobang_ts_store_v1',
    tsSchema: 'gobang-trueskill@1',
    latencyKey: 'gobang_latency_store_v1',
    latencySchema: 'gobang-latency@1',
    resolveMatches: () => {
      const store = readMatchSummaryStore(GOBANG_MATCH_KEY, GOBANG_MATCH_SCHEMA);
      const wins = store.wins || {};
      const detail = `黑方 ${wins.black ?? 0}｜白方 ${wins.white ?? 0}｜平局 ${store.totals.draws ?? 0}`;
      return { total: store.totals.matches ?? 0, detail };
    },
  },
};

function buildLadder(store: TrueSkillStore): LadderEntry[] {
  const entries = Object.values(store.players || {});
  return entries
    .map((entry) => {
      const rating = resolveStoredRating(entry, undefined, TS_DEFAULT);
      if (!rating) return null;
      const cr = rating.mu - 3 * rating.sigma;
      return {
        label: entry.label || entry.id,
        cr,
        mu: rating.mu,
        sigma: rating.sigma,
      } as LadderEntry;
    })
    .filter((entry): entry is LadderEntry => Boolean(entry))
    .sort((a, b) => b.cr - a.cr);
}

function buildLatencySummary(store: LatencyStore): { avg: number | null; samples: number } {
  const players = Object.values(store.players || {});
  let totalSamples = 0;
  let weightedSum = 0;
  players.forEach((entry) => {
    const count = Number(entry.count);
    const mean = Number(entry.mean);
    if (!Number.isFinite(count) || !Number.isFinite(mean) || count <= 0) {
      return;
    }
    totalSamples += count;
    weightedSum += mean * count;
  });

  if (!totalSamples) {
    return { avg: null, samples: 0 };
  }

  return { avg: weightedSum / totalSamples, samples: totalSamples };
}

function formatNumber(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '—';
  }
  try {
    return new Intl.NumberFormat('zh-CN').format(value);
  } catch {
    return String(value);
  }
}

function formatTimestamp(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  try {
    return new Intl.DateTimeFormat('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  } catch {
    return date.toLocaleString();
  }
}

type TrueSkillTableProps = {
  ladder: LadderEntry[];
  title?: string;
  description?: string;
  emptyHint?: string;
};

function TrueSkillTable({ ladder, title = 'TrueSkill 天梯', description, emptyHint }: TrueSkillTableProps) {
  if (!ladder.length) {
    return <div className={styles.emptyState}>{emptyHint || '暂无 TrueSkill 数据，完成一局对局后即可自动生成天梯。'}</div>;
  }
  return (
    <div className={styles.tableShell}>
      <div className={styles.tableHeading}>
        <p className={styles.blockTitle}>{title}</p>
        {description ? <p className={styles.sectionSubtitle}>{description}</p> : null}
      </div>
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>选手</th>
              <th>μ</th>
              <th>σ</th>
              <th>CR</th>
            </tr>
          </thead>
          <tbody>
            {ladder.map((entry) => (
              <tr key={entry.label}>
                <td>{entry.label}</td>
                <td>{entry.mu.toFixed(2)}</td>
                <td>{entry.sigma.toFixed(2)}</td>
                <td>{entry.cr.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function HomeDashboard({ games, onSelectGame }: Props) {
  const [snapshots, setSnapshots] = useState<Partial<Record<GameId, GameStatsSnapshot>>>({});
  const [refreshToken, setRefreshToken] = useState(0);

  const refreshStats = useCallback(() => {
    if (typeof window === 'undefined') return;
    setSnapshots(() => {
      const next: Partial<Record<GameId, GameStatsSnapshot>> = {};
      games.forEach((game) => {
        const config = GAME_STATS_CONFIG[game.id as GameId];
        if (!config) return;
        const tsStore = readTrueSkillStore(config.tsKey, config.tsSchema);
        const latencyStore = readLatencyStore(config.latencyKey, config.latencySchema);
        const matches = config.resolveMatches();
        const ladder = buildLadder(tsStore);
        const latency = buildLatencySummary(latencyStore);
        next[game.id as GameId] = {
          id: game.id as GameId,
          ladder,
          playerCount: Object.keys(tsStore.players || {}).length,
          totalMatches: matches.total ?? null,
          matchDetail: matches.detail,
          latencyAvg: latency.avg,
          latencySamples: latency.samples,
          ladderUpdatedAt: tsStore.updatedAt,
          latencyUpdatedAt: latencyStore.updatedAt,
        };
      });
      return next;
    });
    setRefreshToken((token) => token + 1);
  }, [games]);

  useEffect(() => {
    refreshStats();
    if (typeof window === 'undefined') return undefined;
    const interval = window.setInterval(() => {
      refreshStats();
    }, 2500);
    return () => {
      window.clearInterval(interval);
    };
  }, [refreshStats]);

  const heroItems = useMemo(
    () => [
      '平台仅用于 AI 对抗研究与教学演示，不构成任何竞技或赌博活动。',
      '实时数据包含天梯、TrueSkill、思考耗时及局数，请合理解读。',
      '使用外置 AI 需遵守各模型服务条款，所有 API Key 仅存储在本地浏览器。',
    ],
    [],
  );

  const lastUpdatedLabel = useMemo(() => {
    const timestamps: string[] = [];
    Object.values(snapshots).forEach((snapshot) => {
      if (snapshot?.ladderUpdatedAt) timestamps.push(snapshot.ladderUpdatedAt);
      if (snapshot?.latencyUpdatedAt) timestamps.push(snapshot.latencyUpdatedAt);
    });
    if (!timestamps.length) return '—';
    const latestIso = timestamps.sort().at(-1);
    return formatTimestamp(latestIso);
  }, [snapshots]);

  return (
    <div className={styles.dashboard}>
      <section className={styles.section}>
        <div className={styles.heroHeader}>
          <div>
            <p className={styles.timestamp}>AI GAMES HOME</p>
            <h2 className={styles.heroTitle}>开放式 AI 博弈实验室</h2>
            <p className={styles.heroIntro}>
              统一的平台入口展示所有游戏的天梯、思考耗时与参赛局数，也提供微信打赏与免责声明等信息。
            </p>
          </div>
          <DonationWidget lang="zh" className={styles.refreshButton} />
        </div>
        <ul className={styles.heroList}>
          {heroItems.map((item) => (
            <li key={item} className={styles.heroListItem}>
              <strong>•</strong>
              {item}
            </li>
          ))}
        </ul>
        <div className={styles.disclaimer}>
          <p style={{ fontWeight: 600, margin: '0 0 6px' }}>免责声明</p>
          <p style={{ margin: 0 }}>
            平台所有统计与排行榜均来源于用户本地浏览器，可能因缓存或离线原因与实际训练结果存在差异；任何数据仅供研究参考。
          </p>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.timestamp}>实时统计</p>
            <h2 className={styles.sectionTitle}>积分 / 天梯 / 耗时</h2>
            <p className={styles.sectionSubtitle}>斗地主与五子棋的积分、TrueSkill、累计局数等模块化统计全部汇总在此。</p>
            <p className={styles.timestamp}>最新刷新：{lastUpdatedLabel}</p>
          </div>
          <button type="button" onClick={refreshStats} className={styles.refreshButton}>
            手动刷新
          </button>
        </div>

        <div className={styles.cardStack}>
          <div className={styles.statsBlock}>
            <div className={styles.blockHeader}>
              <div>
                <p className={styles.timestamp}>斗地主</p>
                <h3 className={styles.blockTitle}>积分榜 / 累计局数</h3>
                <p className={styles.blockSubtitle}>与对局界面一致的积分排行、局数统计与耗时概览。</p>
              </div>
              <button type="button" onClick={() => onSelectGame('ddz' as GameId)} className={styles.ctaButton}>
                进入斗地主
              </button>
            </div>
            <dl className={styles.statsGrid}>
              <div className={styles.statCard}>
                <dt className={styles.statLabel}>累计局数</dt>
                <dd className={styles.statValue}>{formatNumber(snapshots.ddz?.totalMatches ?? null)}</dd>
                {snapshots.ddz?.matchDetail ? <p className={styles.statDetail}>{snapshots.ddz.matchDetail}</p> : null}
              </div>
              <div className={styles.statCard}>
                <dt className={styles.statLabel}>平均耗时</dt>
                <dd className={styles.statValue}>
                  {snapshots.ddz?.latencyAvg != null ? `${Math.round(snapshots.ddz.latencyAvg)} ms` : '—'}
                </dd>
                <p className={styles.statDetail}>样本 {formatNumber(snapshots.ddz?.latencySamples ?? null)}</p>
              </div>
              <div className={styles.statCard}>
                <dt className={styles.statLabel}>天梯选手</dt>
                <dd className={styles.statValue}>{formatNumber(snapshots.ddz?.playerCount ?? null)}</dd>
                <p className={styles.statDetail}>更新 {formatTimestamp(snapshots.ddz?.ladderUpdatedAt)}</p>
              </div>
            </dl>

            <div className={styles.cardStack}>
              <DdzLadderCard refreshToken={refreshToken} />
              <TrueSkillTable
                ladder={snapshots.ddz?.ladder ?? []}
                description="按 CR 排序（μ - 3σ），同步展示当前斗地主 TrueSkill 天梯。"
                emptyHint="暂无 TrueSkill 数据，完成一局斗地主后即可生成天梯。"
              />
            </div>
          </div>

          <div className={styles.statsBlock}>
            <div className={styles.blockHeader}>
              <div>
                <p className={styles.timestamp}>五子棋</p>
                <h3 className={styles.blockTitle}>TrueSkill / 对局统计</h3>
                <p className={styles.blockSubtitle}>展示黑白双方累计胜负、TrueSkill 排名与平均耗时。</p>
              </div>
              <button type="button" onClick={() => onSelectGame('gobang' as GameId)} className={styles.ctaButton}>
                进入五子棋
              </button>
            </div>
            <dl className={styles.statsGrid}>
              <div className={styles.statCard}>
                <dt className={styles.statLabel}>累计局数</dt>
                <dd className={styles.statValue}>{formatNumber(snapshots.gobang?.totalMatches ?? null)}</dd>
                {snapshots.gobang?.matchDetail ? <p className={styles.statDetail}>{snapshots.gobang.matchDetail}</p> : null}
              </div>
              <div className={styles.statCard}>
                <dt className={styles.statLabel}>平均耗时</dt>
                <dd className={styles.statValue}>
                  {snapshots.gobang?.latencyAvg != null ? `${Math.round(snapshots.gobang.latencyAvg)} ms` : '—'}
                </dd>
                <p className={styles.statDetail}>样本 {formatNumber(snapshots.gobang?.latencySamples ?? null)}</p>
              </div>
              <div className={styles.statCard}>
                <dt className={styles.statLabel}>天梯选手</dt>
                <dd className={styles.statValue}>{formatNumber(snapshots.gobang?.playerCount ?? null)}</dd>
                <p className={styles.statDetail}>更新 {formatTimestamp(snapshots.gobang?.ladderUpdatedAt)}</p>
              </div>
            </dl>

            <TrueSkillTable
              ladder={snapshots.gobang?.ladder ?? []}
              description="按 CR 排序（μ - 3σ），实时展示黑白双方的 TrueSkill 评级。"
              emptyHint="暂无 TrueSkill 数据，完成一局五子棋后即可自动生成天梯。"
            />
          </div>
        </div>
      </section>
    </div>
  );
}
