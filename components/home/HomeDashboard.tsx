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
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-6 text-sm text-slate-500">
        {emptyHint || '暂无 TrueSkill 数据，完成一局对局后即可自动生成天梯。'}
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white/90 shadow-sm">
      <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-3">
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        {description ? <p className="text-xs text-slate-500">{description}</p> : null}
      </div>
      <div className="max-h-80 overflow-auto">
        <table className="min-w-full divide-y divide-slate-100 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-2">选手</th>
              <th className="px-4 py-2 text-right">μ</th>
              <th className="px-4 py-2 text-right">σ</th>
              <th className="px-4 py-2 text-right">CR</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {ladder.map((entry) => (
              <tr key={entry.label}>
                <td className="px-4 py-2 font-medium text-slate-900">{entry.label}</td>
                <td className="px-4 py-2 text-right font-mono text-slate-700">{entry.mu.toFixed(2)}</td>
                <td className="px-4 py-2 text-right font-mono text-slate-700">{entry.sigma.toFixed(2)}</td>
                <td className="px-4 py-2 text-right font-mono text-slate-900">{entry.cr.toFixed(2)}</td>
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
    <div className="space-y-8">
      <section className="rounded-3xl bg-white/90 p-6 shadow-sm ring-1 ring-slate-100">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-emerald-500">AI GAMES HOME</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">开放式 AI 博弈实验室</h2>
            <p className="mt-2 text-sm text-slate-600">
              统一的平台入口展示所有游戏的天梯、思考耗时与参赛局数，也提供微信打赏与免责声明等信息。
            </p>
          </div>
          <DonationWidget lang="zh" className="self-start" />
        </div>
        <ul className="mt-6 grid gap-3 text-sm text-slate-600 md:grid-cols-3">
          {heroItems.map((item) => (
            <li key={item} className="rounded-2xl bg-slate-50/80 p-4">
              <span className="text-slate-900">•</span> {item}
            </li>
          ))}
        </ul>
        <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-800">
          <p className="font-semibold">免责声明</p>
          <p className="mt-1">
            平台所有统计与排行榜均来源于用户本地浏览器，可能因缓存或离线原因与实际训练结果存在差异；任何数据仅供研究参考。
          </p>
        </div>
      </section>

      <section className="rounded-3xl bg-white/90 p-6 shadow-sm ring-1 ring-slate-100">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-indigo-500">实时统计</p>
            <h2 className="mt-1 text-2xl font-semibold text-slate-900">积分 / 天梯 / 耗时</h2>
            <p className="text-sm text-slate-600">斗地主与五子棋的积分、TrueSkill、累计局数等模块化统计全部汇总在此。</p>
            <p className="mt-2 text-xs text-slate-500">最新刷新：{lastUpdatedLabel}</p>
          </div>
          <button
            type="button"
            onClick={refreshStats}
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
          >
            手动刷新
          </button>
        </div>

        <div className="mt-8 space-y-8">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/40 p-6 shadow-inner">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">斗地主</p>
                <h3 className="mt-1 text-xl font-semibold text-slate-900">积分榜 / 累计局数</h3>
                <p className="text-sm text-slate-600">与对局界面一致的积分排行、局数统计与耗时概览。</p>
              </div>
              <button
                type="button"
                onClick={() => onSelectGame('ddz' as GameId)}
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
              >
                进入斗地主
              </button>
            </div>
            <dl className="mt-4 grid gap-4 text-sm text-slate-600 sm:grid-cols-3">
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">累计局数</dt>
                <dd className="mt-1 text-2xl font-semibold text-slate-900">
                  {formatNumber(snapshots.ddz?.totalMatches ?? null)}
                </dd>
                {snapshots.ddz?.matchDetail ? (
                  <p className="mt-1 text-xs text-slate-500">{snapshots.ddz.matchDetail}</p>
                ) : null}
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">平均耗时</dt>
                <dd className="mt-1 text-2xl font-semibold text-slate-900">
                  {snapshots.ddz?.latencyAvg != null ? `${Math.round(snapshots.ddz.latencyAvg)} ms` : '—'}
                </dd>
                <p className="mt-1 text-xs text-slate-500">
                  样本 {formatNumber(snapshots.ddz?.latencySamples ?? null)}
                </p>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">天梯选手</dt>
                <dd className="mt-1 text-2xl font-semibold text-slate-900">
                  {formatNumber(snapshots.ddz?.playerCount ?? null)}
                </dd>
                <p className="mt-1 text-xs text-slate-500">更新 {formatTimestamp(snapshots.ddz?.ladderUpdatedAt)}</p>
              </div>
            </dl>

            <div className="mt-6">
              <DdzLadderCard refreshToken={refreshToken} />
            </div>

            <div className="mt-6">
              <TrueSkillTable
                ladder={snapshots.ddz?.ladder ?? []}
                description="按 CR 排序（μ - 3σ），同步展示当前斗地主 TrueSkill 天梯。"
                emptyHint="暂无 TrueSkill 数据，完成一局斗地主后即可生成天梯。"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/40 p-6 shadow-inner">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">五子棋</p>
                <h3 className="mt-1 text-xl font-semibold text-slate-900">TrueSkill / 对局统计</h3>
                <p className="text-sm text-slate-600">展示黑白双方累计胜负、TrueSkill 排名与平均耗时。</p>
              </div>
              <button
                type="button"
                onClick={() => onSelectGame('gobang' as GameId)}
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
              >
                进入五子棋
              </button>
            </div>
            <dl className="mt-4 grid gap-4 text-sm text-slate-600 sm:grid-cols-3">
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">累计局数</dt>
                <dd className="mt-1 text-2xl font-semibold text-slate-900">
                  {formatNumber(snapshots.gobang?.totalMatches ?? null)}
                </dd>
                {snapshots.gobang?.matchDetail ? (
                  <p className="mt-1 text-xs text-slate-500">{snapshots.gobang.matchDetail}</p>
                ) : null}
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">平均耗时</dt>
                <dd className="mt-1 text-2xl font-semibold text-slate-900">
                  {snapshots.gobang?.latencyAvg != null ? `${Math.round(snapshots.gobang.latencyAvg)} ms` : '—'}
                </dd>
                <p className="mt-1 text-xs text-slate-500">
                  样本 {formatNumber(snapshots.gobang?.latencySamples ?? null)}
                </p>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-slate-500">天梯选手</dt>
                <dd className="mt-1 text-2xl font-semibold text-slate-900">
                  {formatNumber(snapshots.gobang?.playerCount ?? null)}
                </dd>
                <p className="mt-1 text-xs text-slate-500">更新 {formatTimestamp(snapshots.gobang?.ladderUpdatedAt)}</p>
              </div>
            </dl>

            <div className="mt-6">
              <TrueSkillTable
                ladder={snapshots.gobang?.ladder ?? []}
                description="按 CR 排序（μ - 3σ），实时展示黑白双方的 TrueSkill 评级。"
                emptyHint="暂无 TrueSkill 数据，完成一局五子棋后即可自动生成天梯。"
              />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
