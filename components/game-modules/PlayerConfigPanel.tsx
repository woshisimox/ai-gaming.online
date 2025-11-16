'use client';

import type { ReactNode } from 'react';
import styles from './PlayerConfigPanel.module.css';

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}

export interface PlayerModeOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface PlayerModeOptionGroup {
  label: string;
  options: PlayerModeOption[];
}

export interface PlayerCardInfo {
  title: ReactNode;
  subtitle?: ReactNode;
  badge?: ReactNode;
}

export interface PlayerConfigPanelProps<T = any> {
  title?: ReactNode;
  description?: ReactNode;
  players: PlayerCardInfo[];
  configs: T[];
  optionGroups: PlayerModeOptionGroup[];
  getMode?: (config: T | undefined, index: number) => string | undefined;
  onModeChange?: (index: number, mode: string) => void;
  renderFields?: (index: number, config: T | undefined) => ReactNode;
  renderMeta?: (index: number, config: T | undefined) => ReactNode;
  selectAriaLabel?: (index: number) => string;
  className?: string;
  disabled?: boolean;
}

export function PlayerConfigPanel<T = any>({
  title,
  description,
  players,
  configs,
  optionGroups,
  getMode,
  onModeChange,
  renderFields,
  renderMeta,
  selectAriaLabel,
  className,
  disabled,
}: PlayerConfigPanelProps<T>) {
  const cardCount = players.length;
  const deriveMode = (config: T | undefined, index: number) => {
    if (getMode) return getMode(config, index) ?? '';
    if (config && typeof config === 'object' && 'mode' in (config as Record<string, any>)) {
      return String((config as Record<string, any>).mode || '');
    }
    return '';
  };

  return (
    <section className={cx(styles.root, className)}>
      {(title || description) && (
        <header className={styles.header}>
          {title ? <div className={styles.title}>{title}</div> : null}
          {description ? <p className={styles.description}>{description}</p> : null}
        </header>
      )}
      <div className={styles.grid}>
        {players.map((player, index) => {
          const config = configs[index];
          const mode = deriveMode(config, index);
          return (
            <div key={index} className={styles.card}>
              <div className={styles.titleRow}>
                <div className={styles.playerTitle}>
                  <span>{player.title}</span>
                  {player.subtitle ? <span className={styles.subtitle}>{player.subtitle}</span> : null}
                </div>
                {player.badge ? <span className={styles.badge}>{player.badge}</span> : null}
              </div>
              {renderMeta ? <div className={styles.meta}>{renderMeta(index, config)}</div> : null}
              <label>
                <span className={styles.subtitle}>模式</span>
                <select
                  className={cx(styles.select, disabled && styles.disabledSelect)}
                  value={mode}
                  onChange={(event) => onModeChange?.(index, event.target.value)}
                  aria-label={selectAriaLabel?.(index) || `Player ${index + 1} mode`}
                  disabled={disabled || !onModeChange}
                >
                  {optionGroups.map((group) => (
                    <optgroup key={group.label} label={group.label}>
                      {group.options.map((option) => (
                        <option key={option.value} value={option.value} disabled={option.disabled}>
                          {option.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>
              {renderFields ? <div className={styles.fields}>{renderFields(index, config)}</div> : null}
            </div>
          );
        })}
        {cardCount === 0 ? (
          <div className={styles.card}>暂无参赛选手</div>
        ) : null}
      </div>
    </section>
  );
}

export default PlayerConfigPanel;
