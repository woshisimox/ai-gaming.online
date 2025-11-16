'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { GameDefinition, GameId } from '../../games';
import DonationWidget from '../DonationWidget';
import DdzLadderCard from './DdzLadderCard';
import SiteInfoButtons from './SiteInfoButtons';
import {
  readTrueSkillStore,
  resolveStoredRating,
  TS_DEFAULT,
  type TrueSkillStore,
} from '../../lib/game-modules/trueSkill';
import { readLatencyStore, type LatencyStore } from '../../lib/game-modules/latencyStore';
import { readMatchSummaryStore } from '../../lib/game-modules/matchStatsStore';
import { computeDdzTotalMatches, readDdzLadderPlayers } from '../../lib/game-modules/ddzLadder';
import {
  emitSiteLanguageChange,
  readSiteLanguage,
  writeSiteLanguage,
  type SiteLanguage,
} from '../../lib/siteLanguage';
import styles from './HomeDashboard.module.css';

type Lang = SiteLanguage;

const LANG_OPTIONS: Array<{ id: Lang; label: string }> = [
  { id: 'zh', label: '中文' },
  { id: 'en', label: 'EN' },
];

const LOCALES: Record<Lang, string> = {
  zh: 'zh-CN',
  en: 'en-US',
};

type CopyBlock = {
  heroTitle: string;
  heroIntro: string;
  heroItems: string[];
  disclaimerTitle: string;
  disclaimerBody: string;
  statsTimestamp: string;
  statsTitle: string;
  statsSubtitle: string;
  latestRefreshLabel: string;
  refreshButton: string;
  statLabels: {
    totalMatches: string;
    avgLatency: string;
    players: string;
    samples: string;
    updated: string;
  };
  trueSkillTitle: string;
  ddz: {
    timestamp: string;
    blockTitle: string;
    blockSubtitle: string;
    cta: string;
    ladderDescription: string;
    trueSkillDescription: string;
    trueSkillEmpty: string;
  };
  gobang: {
    timestamp: string;
    blockTitle: string;
    blockSubtitle: string;
    cta: string;
    trueSkillDescription: string;
    trueSkillEmpty: string;
  };
};

const COPY: Record<Lang, CopyBlock> = {
  zh: {
    heroTitle: '开放式 AI 博弈实验室',
    heroIntro: '统一的平台入口展示所有游戏的天梯、思考耗时与参赛局数，也提供微信打赏与免责声明等信息。',
    heroItems: [
      '平台仅用于 AI 对抗研究与教学演示，不构成任何竞技或赌博活动。',
      '实时数据包含天梯、TrueSkill、思考耗时及局数，请合理解读。',
      '使用外置 AI 需遵守各模型服务条款，所有 API Key 仅存储在本地浏览器。',
    ],
    disclaimerTitle: '免责声明',
    disclaimerBody:
      '平台所有统计与排行榜均来源于用户本地浏览器，可能因缓存或离线原因与实际训练结果存在差异；任何数据仅供研究参考。',
    statsTimestamp: '实时统计',
    statsTitle: '积分 / 天梯 / 耗时',
    statsSubtitle: '斗地主与五子棋的积分、TrueSkill、累计局数等模块化统计全部汇总在此。',
    latestRefreshLabel: '最新刷新',
    refreshButton: '手动刷新',
    statLabels: {
      totalMatches: '累计局数',
      avgLatency: '平均耗时',
      players: '天梯选手',
      samples: '样本',
      updated: '更新',
    },
    trueSkillTitle: 'TrueSkill 天梯',
    ddz: {
      timestamp: '斗地主',
      blockTitle: '积分榜 / 累计局数',
      blockSubtitle: '与对局界面一致的积分排行、局数统计与耗时概览。',
      cta: '进入斗地主',
      ladderDescription: '与对局界面一致的积分排行、局数统计与耗时概览。',
      trueSkillDescription: '按 CR 排序（μ - 3σ），同步展示当前斗地主 TrueSkill 天梯。',
      trueSkillEmpty: '暂无 TrueSkill 数据，完成一局斗地主后即可生成天梯。',
    },
    gobang: {
      timestamp: '五子棋',
      blockTitle: 'TrueSkill / 对局统计',
      blockSubtitle: '展示黑白双方累计胜负、TrueSkill 排名与平均耗时。',
      cta: '进入五子棋',
      trueSkillDescription: '按 CR 排序（μ - 3σ），实时展示黑白双方的 TrueSkill 评级。',
      trueSkillEmpty: '暂无 TrueSkill 数据，完成一局五子棋后即可自动生成天梯。',
    },
  },
  en: {
    heroTitle: 'Open AI Gaming Lab',
    heroIntro:
      'The unified landing tab surfaces ladders, thinking latency, match totals, and donation / policy info for every integrated game.',
    heroItems: [
      'For AI-versus-AI research and teaching demos only—no gambling or competitive guarantees.',
      'Live data covers ladders, TrueSkill, thinking latency, and match totals for every ruleset.',
      'External AI integrations must follow each provider’s terms; all API keys stay inside your browser.',
    ],
    disclaimerTitle: 'Disclaimer',
    disclaimerBody:
      'All stats and leaderboards are stored locally in your browser and may differ from remote training results. Research use only.',
    statsTimestamp: 'LIVE STATS',
    statsTitle: 'Ratings · Ladder · Latency',
    statsSubtitle: 'Modular metrics for Dou Dizhu and Gomoku are aggregated here.',
    latestRefreshLabel: 'Last refresh',
    refreshButton: 'Refresh now',
    statLabels: {
      totalMatches: 'Total matches',
      avgLatency: 'Avg latency',
      players: 'Ladder entrants',
      samples: 'Samples',
      updated: 'Updated',
    },
    trueSkillTitle: 'TrueSkill Ladder',
    ddz: {
      timestamp: 'Dou Dizhu',
      blockTitle: 'Ratings & Totals',
      blockSubtitle: 'Same leaderboard, totals, and latency summary used inside the match view.',
      cta: 'Open Dou Dizhu',
      ladderDescription: 'Live ΔR, match totals, and latency data from the Dou Dizhu renderer.',
      trueSkillDescription: 'CR (μ - 3σ) ordering of the Dou Dizhu TrueSkill ladder.',
      trueSkillEmpty: 'Play a Dou Dizhu round to generate the ladder.',
    },
    gobang: {
      timestamp: 'Gomoku',
      blockTitle: 'TrueSkill & Match Stats',
      blockSubtitle: 'Summaries of black/white wins, ladder standings, and average thinking time.',
      cta: 'Open Gomoku',
      trueSkillDescription: 'CR (μ - 3σ) ordering of the Gomoku TrueSkill ratings.',
      trueSkillEmpty: 'Finish a Gomoku match to populate the ladder.',
    },
  },
};

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

type MatchResolverResult = {
  total: number | null;
  detail?: string;
  labelMap?: Record<string, string>;
};

type MatchResolver = (lang: Lang) => MatchResolverResult;

type StatsConfig = {
  tsKey: string;
  tsSchema: string;
  latencyKey: string;
  latencySchema: string;
  resolveMatches: MatchResolver;
};

const GOBANG_MATCH_KEY = 'gobang_match_stats_v1';
const GOBANG_MATCH_SCHEMA = 'gobang-match-stats@1';

const GAME_STATS_CONFIG: Partial<Record<GameId, StatsConfig>> = {
  ddz: {
    tsKey: 'ddz_ts_store_v1',
    tsSchema: 'ddz-trueskill@1',
    latencyKey: 'ddz_latency_store_v1',
    latencySchema: 'ddz-latency@3',
    resolveMatches: (lang) => {
      const players = readDdzLadderPlayers();
      const { totalMatches, playerGameSum } = computeDdzTotalMatches(players);
      const locale = LOCALES[lang];
      const format = new Intl.NumberFormat(locale);
      const detail = playerGameSum
        ? lang === 'zh'
          ? `全部选手共计 ${format.format(playerGameSum)} 局参与记录 → 折算约 ${format.format(totalMatches)} 场（三人一局）`
          : `All entrants logged ${format.format(playerGameSum)} player-games → roughly ${format.format(totalMatches)} matches (3 seats per round).`
        : lang === 'zh'
        ? '等待第一局对战完成后自动生成统计'
        : 'Play the first match to generate these stats.';
      const labelMap = players.reduce<Record<string, string>>((map, player) => {
        map[player.id] = player.label;
        return map;
      }, {});
      return { total: totalMatches, detail, labelMap };
    },
  },
  gobang: {
    tsKey: 'gobang_ts_store_v1',
    tsSchema: 'gobang-trueskill@1',
    latencyKey: 'gobang_latency_store_v1',
    latencySchema: 'gobang-latency@1',
    resolveMatches: (lang) => {
      const store = readMatchSummaryStore(GOBANG_MATCH_KEY, GOBANG_MATCH_SCHEMA);
      const wins = store.wins || {};
      const locale = LOCALES[lang];
      const format = new Intl.NumberFormat(locale);
      const detail = lang === 'zh'
        ? `黑方 ${format.format(wins.black ?? 0)}｜白方 ${format.format(wins.white ?? 0)}｜平局 ${format.format(store.totals.draws ?? 0)}`
        : `Black ${format.format(wins.black ?? 0)} | White ${format.format(wins.white ?? 0)} | Draws ${format.format(
            store.totals.draws ?? 0,
          )}`;
      return { total: store.totals.matches ?? 0, detail };
    },
  },
};

function buildLadder(store: TrueSkillStore, labelMap?: Record<string, string>): LadderEntry[] {
  const entries = Object.values(store.players || {});
  return entries
    .map((entry) => {
      const rating = resolveStoredRating(entry, undefined, TS_DEFAULT);
      if (!rating) return null;
      const cr = rating.mu - 3 * rating.sigma;
      return {
        label: labelMap?.[entry.id] || entry.label || entry.id,
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

function formatNumber(value: number | null | undefined, locale: string): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '—';
  }
  try {
    return new Intl.NumberFormat(locale).format(value);
  } catch {
    return String(value);
  }
}

function formatTimestamp(value: string | undefined, locale: string): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  try {
    return new Intl.DateTimeFormat(locale, {
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
  lang: Lang;
  title?: string;
  description?: string;
  emptyHint?: string;
};

function TrueSkillTable({ ladder, lang, title, description, emptyHint }: TrueSkillTableProps) {
  const computedTitle = title ?? (lang === 'zh' ? 'TrueSkill 天梯' : 'TrueSkill Ladder');
  const labels = lang === 'zh'
    ? { player: '选手', mu: 'μ', sigma: 'σ', cr: 'CR', empty: '暂无 TrueSkill 数据，完成一局对局后即可自动生成天梯。' }
    : { player: 'Player', mu: 'μ', sigma: 'σ', cr: 'CR', empty: 'No TrueSkill data yet—finish a match to populate the ladder.' };
  if (!ladder.length) {
    return <div className={styles.emptyState}>{emptyHint || labels.empty}</div>;
  }
  return (
    <div className={styles.tableShell}>
      <div className={styles.tableHeading}>
        <p className={styles.blockTitle}>{computedTitle}</p>
        {description ? <p className={styles.sectionSubtitle}>{description}</p> : null}
      </div>
      <div className={styles.tableScroll}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{labels.player}</th>
              <th>{labels.mu}</th>
              <th>{labels.sigma}</th>
              <th>{labels.cr}</th>
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
  const [lang, setLang] = useState<Lang>(() => readSiteLanguage() ?? 'zh');
  const copy = COPY[lang];
  const locale = LOCALES[lang];

  useEffect(() => {
    const stored = readSiteLanguage();
    if (stored && stored !== lang) {
      setLang(stored);
    }
  }, []);

  useEffect(() => {
    writeSiteLanguage(lang);
    emitSiteLanguageChange(lang);
  }, [lang]);

  const refreshStats = useCallback(() => {
    if (typeof window === 'undefined') return;
    setSnapshots(() => {
      const next: Partial<Record<GameId, GameStatsSnapshot>> = {};
      games.forEach((game) => {
        const config = GAME_STATS_CONFIG[game.id as GameId];
        if (!config) return;
        const tsStore = readTrueSkillStore(config.tsKey, config.tsSchema);
        const latencyStore = readLatencyStore(config.latencyKey, config.latencySchema);
        const matches = config.resolveMatches(lang);
        const ladder = buildLadder(tsStore, matches.labelMap);
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
  }, [games, lang]);

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

  const lastUpdatedLabel = useMemo(() => {
    const timestamps: string[] = [];
    Object.values(snapshots).forEach((snapshot) => {
      if (snapshot?.ladderUpdatedAt) timestamps.push(snapshot.ladderUpdatedAt);
      if (snapshot?.latencyUpdatedAt) timestamps.push(snapshot.latencyUpdatedAt);
    });
    if (!timestamps.length) return '—';
    const latestIso = timestamps.sort().at(-1);
    return formatTimestamp(latestIso, locale);
  }, [snapshots, locale]);

  return (
    <div className={styles.dashboard}>
      <section className={styles.section}>
        <div className={styles.heroHeader}>
          <div>
            <p className={styles.timestamp}>AI GAMES HOME</p>
            <h2 className={styles.heroTitle}>{copy.heroTitle}</h2>
            <p className={styles.heroIntro}>{copy.heroIntro}</p>
          </div>
          <div className={styles.heroActions}>
            <div className={styles.langToggle}>
              {LANG_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setLang(option.id)}
                  className={`${styles.langButton} ${lang === option.id ? styles.langButtonActive : ''}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <SiteInfoButtons
              lang={lang}
              trailingNode={<DonationWidget lang={lang} className={styles.donationButton} />}
            />
          </div>
        </div>
        <ul className={styles.heroList}>
          {copy.heroItems.map((item) => (
            <li key={item} className={styles.heroListItem}>
              <strong>•</strong>
              {item}
            </li>
          ))}
        </ul>
        <div className={styles.disclaimer}>
          <p style={{ fontWeight: 600, margin: '0 0 6px' }}>{copy.disclaimerTitle}</p>
          <p style={{ margin: 0 }}>{copy.disclaimerBody}</p>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <p className={styles.timestamp}>{copy.statsTimestamp}</p>
            <h2 className={styles.sectionTitle}>{copy.statsTitle}</h2>
            <p className={styles.sectionSubtitle}>{copy.statsSubtitle}</p>
            <p className={styles.timestamp}>
              {copy.latestRefreshLabel}: {lastUpdatedLabel}
            </p>
          </div>
          <button type="button" onClick={refreshStats} className={styles.refreshButton}>
            {copy.refreshButton}
          </button>
        </div>

        <div className={styles.cardStack}>
          <div className={styles.statsBlock}>
            <div className={styles.blockHeader}>
              <div>
                <p className={styles.timestamp}>{copy.ddz.timestamp}</p>
                <h3 className={styles.blockTitle}>{copy.ddz.blockTitle}</h3>
                <p className={styles.blockSubtitle}>{copy.ddz.blockSubtitle}</p>
              </div>
              <button type="button" onClick={() => onSelectGame('ddz' as GameId)} className={styles.ctaButton}>
                {copy.ddz.cta}
              </button>
            </div>
            <dl className={styles.statsGrid}>
              <div className={styles.statCard}>
                <dt className={styles.statLabel}>{copy.statLabels.totalMatches}</dt>
                <dd className={styles.statValue}>{formatNumber(snapshots.ddz?.totalMatches ?? null, locale)}</dd>
                {snapshots.ddz?.matchDetail ? <p className={styles.statDetail}>{snapshots.ddz.matchDetail}</p> : null}
              </div>
              <div className={styles.statCard}>
                <dt className={styles.statLabel}>{copy.statLabels.avgLatency}</dt>
                <dd className={styles.statValue}>
                  {snapshots.ddz?.latencyAvg != null ? `${Math.round(snapshots.ddz.latencyAvg)} ms` : '—'}
                </dd>
                <p className={styles.statDetail}>
                  {copy.statLabels.samples} {formatNumber(snapshots.ddz?.latencySamples ?? null, locale)}
                </p>
              </div>
              <div className={styles.statCard}>
                <dt className={styles.statLabel}>{copy.statLabels.players}</dt>
                <dd className={styles.statValue}>{formatNumber(snapshots.ddz?.playerCount ?? null, locale)}</dd>
                <p className={styles.statDetail}>
                  {copy.statLabels.updated} {formatTimestamp(snapshots.ddz?.ladderUpdatedAt, locale)}
                </p>
              </div>
            </dl>

            <div className={styles.cardStack}>
              <DdzLadderCard refreshToken={refreshToken} lang={lang} />
              <TrueSkillTable
                lang={lang}
                ladder={snapshots.ddz?.ladder ?? []}
                title={copy.trueSkillTitle}
                description={copy.ddz.trueSkillDescription}
                emptyHint={copy.ddz.trueSkillEmpty}
              />
            </div>
          </div>

          <div className={styles.statsBlock}>
            <div className={styles.blockHeader}>
              <div>
                <p className={styles.timestamp}>{copy.gobang.timestamp}</p>
                <h3 className={styles.blockTitle}>{copy.gobang.blockTitle}</h3>
                <p className={styles.blockSubtitle}>{copy.gobang.blockSubtitle}</p>
              </div>
              <button type="button" onClick={() => onSelectGame('gobang' as GameId)} className={styles.ctaButton}>
                {copy.gobang.cta}
              </button>
            </div>
            <dl className={styles.statsGrid}>
              <div className={styles.statCard}>
                <dt className={styles.statLabel}>{copy.statLabels.totalMatches}</dt>
                <dd className={styles.statValue}>{formatNumber(snapshots.gobang?.totalMatches ?? null, locale)}</dd>
                {snapshots.gobang?.matchDetail ? <p className={styles.statDetail}>{snapshots.gobang.matchDetail}</p> : null}
              </div>
              <div className={styles.statCard}>
                <dt className={styles.statLabel}>{copy.statLabels.avgLatency}</dt>
                <dd className={styles.statValue}>
                  {snapshots.gobang?.latencyAvg != null ? `${Math.round(snapshots.gobang.latencyAvg)} ms` : '—'}
                </dd>
                <p className={styles.statDetail}>
                  {copy.statLabels.samples} {formatNumber(snapshots.gobang?.latencySamples ?? null, locale)}
                </p>
              </div>
              <div className={styles.statCard}>
                <dt className={styles.statLabel}>{copy.statLabels.players}</dt>
                <dd className={styles.statValue}>{formatNumber(snapshots.gobang?.playerCount ?? null, locale)}</dd>
                <p className={styles.statDetail}>
                  {copy.statLabels.updated} {formatTimestamp(snapshots.gobang?.ladderUpdatedAt, locale)}
                </p>
              </div>
            </dl>

            <TrueSkillTable
              lang={lang}
              ladder={snapshots.gobang?.ladder ?? []}
              title={copy.trueSkillTitle}
              description={copy.gobang.trueSkillDescription}
              emptyHint={copy.gobang.trueSkillEmpty}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
