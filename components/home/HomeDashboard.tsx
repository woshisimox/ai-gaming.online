'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { GameDefinition, GameId } from '../../games';
import DonationWidget from '../DonationWidget';
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
    .sort((a, b) => b.cr - a.cr)
    .slice(0, 5);
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

function StatsCard({ game, snapshot, onSelectGame }: { game: GameDefinition; snapshot?: GameStatsSnapshot; onSelectGame: (id: GameId) => void }) {
  const ladder = snapshot?.ladder ?? [];
  return (
    <div className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">实时数据</p>
          <h3 className="mt-1 text-xl font-semibold text-slate-900">{game.displayName}</h3>
          {game.description ? <p className="mt-1 text-sm text-slate-600">{game.description}</p> : null}
        </div>
        <button
          type="button"
          onClick={() => onSelectGame(game.id as GameId)}
          className="rounded-full border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
        >
          进入
        </button>
      </div>

      <dl className="mt-6 grid grid-cols-1 gap-4 text-sm text-slate-600 sm:grid-cols-3">
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">累计局数</dt>
          <dd className="mt-1 text-2xl font-semibold text-slate-900">{snapshot ? formatNumber(snapshot.totalMatches) : '—'}</dd>
          {snapshot?.matchDetail ? (
            <p className="mt-1 text-xs text-slate-500">{snapshot.matchDetail}</p>
          ) : null}
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">平均耗时</dt>
          <dd className="mt-1 text-2xl font-semibold text-slate-900">
            {snapshot?.latencyAvg != null ? `${Math.round(snapshot.latencyAvg)} ms` : '—'}
          </dd>
          <p className="mt-1 text-xs text-slate-500">样本 {snapshot ? formatNumber(snapshot.latencySamples) : '—'}</p>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wide text-slate-500">天梯选手</dt>
          <dd className="mt-1 text-2xl font-semibold text-slate-900">{snapshot ? formatNumber(snapshot.playerCount) : '—'}</dd>
          <p className="mt-1 text-xs text-slate-500">更新 {formatTimestamp(snapshot?.ladderUpdatedAt)}</p>
        </div>
      </dl>

      <div className="mt-6 flex-1 rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">天梯（CR）</p>
        <ul className="mt-3 space-y-2">
          {ladder.length ? (
            ladder.map((entry, index) => (
              <li key={`${entry.label}-${index}`} className="flex items-center justify-between text-sm text-slate-700">
                <span>
                  <span className="font-semibold text-slate-900">{index + 1}.</span> {entry.label}
                </span>
                <span className="font-mono text-slate-900">{entry.cr.toFixed(1)}</span>
              </li>
            ))
          ) : (
            <li className="text-sm text-slate-500">暂无天梯数据</li>
          )}
        </ul>
        <p className="mt-3 text-xs text-slate-500">最新耗时更新 {formatTimestamp(snapshot?.latencyUpdatedAt)}</p>
      </div>
    </div>
  );
}

export default function HomeDashboard({ games, onSelectGame }: Props) {
  const [snapshots, setSnapshots] = useState<Partial<Record<GameId, GameStatsSnapshot>>>({});

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
            <h2 className="mt-1 text-2xl font-semibold text-slate-900">各游戏天梯 / 耗时 / 局数</h2>
            <p className="text-sm text-slate-600">数据自动每 2.5 秒刷新，可随时点击下方按钮进入对应竞赛页面。</p>
          </div>
          <button
            type="button"
            onClick={refreshStats}
            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 hover:text-slate-900"
          >
            手动刷新
          </button>
        </div>
        <div className="mt-6 grid gap-6 md:grid-cols-2">
          {games.map((game) => (
            <StatsCard
              key={game.id}
              game={game}
              snapshot={snapshots[game.id as GameId]}
              onSelectGame={onSelectGame}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
