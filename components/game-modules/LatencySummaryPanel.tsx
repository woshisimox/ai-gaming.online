'use client';

import type { ReactNode } from 'react';
import type { LatencyStore } from '../../lib/game-modules/latencyStore';

export interface LatencySummaryPanelProps {
  store: LatencyStore | null;
  lastMs?: (number | null)[];
  identities?: string[];
  defaultCatalog?: string[];
  labelForIdentity?: (id: string) => string;
  lang?: 'zh' | 'en';
  title?: ReactNode;
  subtitle?: ReactNode;
}

const defaultLabel = (id: string) => id;

export function LatencySummaryPanel({
  store,
  lastMs,
  identities,
  defaultCatalog,
  labelForIdentity = defaultLabel,
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
    const lastEntry = latest.get(id) || null;
    return { id, label: labelRaw, mean, count, lastEntry };
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
    <div style={{ border: '1px dashed #cbd5f5', borderRadius: 12, padding: 16, background: '#f8fafc' }}>
      <div style={{ fontWeight: 700, marginBottom: 4 }}>{resolvedTitle}</div>
      <div style={{ fontSize: 12, color: '#64748b', marginBottom: 12 }}>{resolvedSubtitle}</div>
      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr 80px 140px', gap: 8, rowGap: 10 }}>
        {items.map((item) => {
          const pct = item.count > 0 ? Math.min(1, item.mean / scale || 0) : 0;
          const lastEntry = item.lastEntry;
          const seatTag = lastEntry ? `${lastEntry.seat}` : '';
          return (
            <div key={item.id} style={{ display: 'contents' }}>
              <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {item.label}
              </div>
              <div
                style={{
                  position: 'relative',
                  height: 18,
                  background: '#e2e8f0',
                  borderRadius: 9999,
                  overflow: 'hidden',
                  border: '1px solid #cbd5f5',
                }}
              >
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    width: `${pct * 100}%`,
                    background: '#38bdf8',
                    transition: 'width 0.3s ease',
                    borderRadius: 9999,
                  }}
                />
              </div>
              <div style={{ fontFamily: 'ui-monospace,Menlo,Consolas,monospace', textAlign: 'right' }}>
                {item.count > 0 ? `${fmt(item.mean)} ms` : '—'}
              </div>
              <div style={{ fontSize: 12, color: '#475569' }}>
                <div>
                  {countLabel}
                  {item.count}
                </div>
                <div>
                  {lastLabel}
                  {colon}
                  {lastEntry?.ms != null ? `${fmt(lastEntry.ms)} ms` : '—'}
                  {wrapSeatTag(seatTag)}
                </div>
              </div>
            </div>
          );
        })}
        {!items.length && <div>暂无记录</div>}
      </div>
    </div>
  );
}

export default LatencySummaryPanel;
