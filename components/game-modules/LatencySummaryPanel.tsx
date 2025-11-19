'use client';

import type { ReactNode } from 'react';
import type { LatencyStore } from '../../lib/game-modules/latencyStore';
import styles from './LatencySummaryPanel.module.css';

export interface LatencySummaryPanelProps {
  store: LatencyStore | null;
  lastMs?: (number | null)[];
  identities?: string[];
  defaultCatalog?: string[];
  labelForIdentity?: (id: string) => string;
  formatLabel?: (label: string, id: string) => string;
  lang?: 'zh' | 'en';
  title?: ReactNode;
  subtitle?: ReactNode;
}

const defaultLabel = (id: string) => id;
const passthrough = (label: string) => label;

export function LatencySummaryPanel({
  store,
  lastMs,
  identities,
  defaultCatalog,
  labelForIdentity = defaultLabel,
  formatLabel = passthrough,
  lang = 'zh',
  title,
  subtitle,
}: LatencySummaryPanelProps) {
  const players = store?.players || {};
  const latest = new Map<string, { ms: number | null; seat: number }>();
  if (identities && lastMs) {
    identities.forEach((id, idx) => {
      if (!id) return;
      latest.set(id, { ms: lastMs[idx] ?? null, seat: idx });
    });
  }
  const catalog = new Set<string>();
  Object.keys(players).forEach((key) => catalog.add(key));
  (defaultCatalog || []).forEach((key) => catalog.add(key));
  (identities || []).forEach((key) => key && catalog.add(key));
  const items = Array.from(catalog).map((id) => {
    const entry = players[id];
    const mean = Number(entry?.mean) || 0;
    const count = Math.max(0, Number(entry?.count) || 0);
    const labelRaw = typeof entry?.label === 'string' && entry.label.trim() ? entry.label.trim() : labelForIdentity(id);
    const label = formatLabel(labelRaw, id);
    const lastEntry = latest.get(id) || null;
    return { id, label: label || labelRaw, mean, count, lastEntry };
  });

  items.sort((a, b) => {
    const aHas = a.count > 0;
    const bHas = b.count > 0;
    if (aHas && bHas) {
      if (a.mean !== b.mean) return a.mean - b.mean;
      return a.label.localeCompare(b.label);
    }
    if (aHas) return -1;
    if (bHas) return 1;
    return a.label.localeCompare(b.label);
  });

  const maxMean = Math.max(0, ...items.filter((it) => it.count > 0).map((it) => it.mean));
  const scale = maxMean > 0 ? maxMean : 1;
  const fmt = (value: number | null) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
    if (value >= 1000) return value.toFixed(0);
    return value.toFixed(1);
  };

  const resolvedTitle = title ?? (lang === 'en' ? 'Thinking latency' : '思考耗时统计');
  const resolvedSubtitle =
    subtitle ?? (lang === 'en'
      ? 'Sorted by shorter average thinking time; values in milliseconds'
      : '按平均耗时从短到长排序，单位毫秒');
  const countLabel = lang === 'en' ? 'n=' : '次数=';
  const lastLabel = lang === 'en' ? 'Latest' : '最近';
  const seatLabelPrefix = lang === 'en' ? 'Seat ' : '座位';
  const colon = lang === 'en' ? ': ' : '：';
  const wrapSeatTag = (tag: string) => {
    if (!tag) return '';
    return lang === 'en' ? ` (${seatLabelPrefix}${tag})` : `（${seatLabelPrefix}${tag}）`;
  };

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.title}>{resolvedTitle}</div>
        <div className={styles.subtitle}>{resolvedSubtitle}</div>
      </div>
      {items.length ? (
        <div className={styles.grid}>
          {items.map((item) => {
            const pct = item.count > 0 ? Math.min(1, item.mean / scale || 0) : 0;
            const lastEntry = item.lastEntry;
            const seatTag = lastEntry ? `${lastEntry.seat}` : '';
            return (
              <div key={item.id} className={styles.row}>
                <div className={styles.label}>{item.label}</div>
                <div className={styles.track}>
                  <div className={styles.fill} style={{ width: `${pct * 100}%` }} />
                </div>
                <div className={styles.valueStack}>
                  <span className={styles.valuePrimary}>{item.count > 0 ? `${fmt(item.mean)} ms` : '—'}</span>
                  <span className={styles.valueMeta}>
                    {countLabel}
                    {item.count}
                    {lastEntry && (
                      <>
                        {' · '}
                        {lastLabel}
                        {colon}
                        {lastEntry.ms != null ? `${fmt(lastEntry.ms)} ms` : '—'}
                        {wrapSeatTag(seatTag)}
                      </>
                    )}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className={styles.empty}>{lang === 'en' ? 'No latency records yet.' : '暂无思考耗时记录。'}</p>
      )}
    </div>
  );
}

export default LatencySummaryPanel;
