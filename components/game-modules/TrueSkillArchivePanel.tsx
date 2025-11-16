'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  readTrueSkillStore,
  writeTrueSkillStore,
  importTrueSkillArchive,
  formatTrueSkillArchiveName,
  resolveStoredRating,
  type TrueSkillStore,
  type Rating,
} from '../../lib/game-modules/trueSkill';
import styles from './TrueSkillArchivePanel.module.css';

export interface TrueSkillIdentity {
  id: string;
  label: string;
  role?: string;
}

interface ActionLabels {
  apply?: string;
  export?: string;
  import?: string;
}

export interface TrueSkillArchivePanelProps {
  title?: string;
  description?: string;
  storeKey: string;
  schema: string;
  exportName?: string;
  players?: TrueSkillIdentity[];
  onApply?: (store: TrueSkillStore) => void;
  onStoreChange?: (store: TrueSkillStore) => void;
  actionLabels?: ActionLabels;
  className?: string;
}

export function TrueSkillArchivePanel({
  title = 'TrueSkill 存档',
  description = '应用、导出或导入 TrueSkill 档案，用于多游戏共享选手评级。',
  storeKey,
  schema,
  exportName = 'trueskill_archive',
  players,
  onApply,
  onStoreChange,
  actionLabels,
  className,
}: TrueSkillArchivePanelProps) {
  const [store, setStore] = useState<TrueSkillStore>(() => readTrueSkillStore(storeKey, schema));
  const storeRef = useRef(store);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const setAndPersistStore = useCallback(
    (next: TrueSkillStore) => {
      storeRef.current = writeTrueSkillStore(storeKey, next);
      setStore(storeRef.current);
      onStoreChange?.(storeRef.current);
    },
    [onStoreChange, storeKey],
  );

  const handleApply = useCallback(() => {
    onApply?.(storeRef.current);
  }, [onApply]);

  const handleExport = useCallback(() => {
    const blob = new Blob([JSON.stringify(storeRef.current, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = formatTrueSkillArchiveName(exportName);
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }, [exportName]);

  const handleImport = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = importTrueSkillArchive(text, schema);
      setAndPersistStore(parsed);
    } catch (error) {
      console.error('Failed to import TrueSkill archive', error);
    } finally {
      event.target.value = '';
    }
  }, [schema, setAndPersistStore]);

  const playerRows = useMemo(() => {
    if (!players || !players.length) return [] as Array<{ label: string; rating: Rating | null; role?: string }>;
    return players.map((identity) => {
      const entry = store.players[identity.id];
      const rating = resolveStoredRating(entry, identity.role || undefined);
      return { label: identity.label, rating, role: identity.role };
    });
  }, [players, store]);

  return (
    <section className={`${styles.root} ${className || ''}`}>
      <div className={styles.header}>
        <div className={styles.title}>{title}</div>
        <p className={styles.description}>{description}</p>
      </div>
      <div className={styles.actions}>
        <button type="button" className={styles.button} onClick={handleApply}>
          {actionLabels?.apply ?? '应用存档'}
        </button>
        <button type="button" className={styles.button} onClick={handleExport}>
          {actionLabels?.export ?? '导出' }
        </button>
        <label className={`${styles.button} ${styles.uploadLabel}`}>
          {actionLabels?.import ?? '导入'}
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json"
            className={styles.uploadInput}
            onChange={handleImport}
          />
        </label>
      </div>
      {playerRows.length ? (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th align="left">选手</th>
                <th align="right">μ</th>
                <th align="right">σ</th>
                <th align="right">CR</th>
              </tr>
            </thead>
            <tbody>
              {playerRows.map((row, index) => (
                <tr key={`${row.label}-${index}`}>
                  <td>{row.label}</td>
                  <td align="right">{row.rating ? row.rating.mu.toFixed(2) : '—'}</td>
                  <td align="right">{row.rating ? row.rating.sigma.toFixed(2) : '—'}</td>
                  <td align="right">{row.rating ? (row.rating.mu - 3 * row.rating.sigma).toFixed(2) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className={styles.emptyRow}>暂无选手数据</div>
      )}
    </section>
  );
}

export default TrueSkillArchivePanel;
