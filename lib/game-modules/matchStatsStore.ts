export interface MatchSummaryStore {
  schema: string;
  updatedAt: string;
  totals: {
    matches: number;
    draws: number;
  };
  wins: Record<string, number>;
}

function createDefaultStore(schema: string): MatchSummaryStore {
  return {
    schema,
    updatedAt: new Date().toISOString(),
    totals: { matches: 0, draws: 0 },
    wins: {},
  };
}

export function ensureMatchSummaryStore(raw: any, schema: string): MatchSummaryStore {
  if (raw && typeof raw === 'object' && raw.schema === schema) {
    const matches = Number(raw?.totals?.matches);
    const draws = Number(raw?.totals?.draws);
    const wins: Record<string, number> = {};
    if (raw?.wins && typeof raw.wins === 'object') {
      for (const key of Object.keys(raw.wins)) {
        const value = Number(raw.wins[key]);
        if (Number.isFinite(value) && value >= 0) {
          wins[key] = Math.floor(value);
        }
      }
    }

    return {
      schema,
      updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString(),
      totals: {
        matches: Number.isFinite(matches) && matches >= 0 ? Math.floor(matches) : 0,
        draws: Number.isFinite(draws) && draws >= 0 ? Math.floor(draws) : 0,
      },
      wins,
    };
  }
  return createDefaultStore(schema);
}

export function readMatchSummaryStore(key: string, schema: string): MatchSummaryStore {
  if (typeof window === 'undefined') {
    return createDefaultStore(schema);
  }
  try {
    const raw = window.localStorage.getItem(key);
    if (raw) {
      return ensureMatchSummaryStore(JSON.parse(raw), schema);
    }
  } catch {
    // ignore storage errors
  }
  return createDefaultStore(schema);
}

export function writeMatchSummaryStore(key: string, store: MatchSummaryStore): MatchSummaryStore {
  const next: MatchSummaryStore = {
    schema: store.schema,
    updatedAt: new Date().toISOString(),
    totals: {
      matches: Math.max(0, Math.floor(store.totals?.matches ?? 0)),
      draws: Math.max(0, Math.floor(store.totals?.draws ?? 0)),
    },
    wins: { ...(store.wins || {}) },
  };
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function incrementMatchSummary(
  store: MatchSummaryStore,
  winnerKey: string | null,
): MatchSummaryStore {
  const base = ensureMatchSummaryStore(store, store.schema);
  const wins = { ...base.wins };
  const totals = {
    matches: Math.max(0, base.totals.matches) + 1,
    draws: Math.max(0, base.totals.draws),
  };

  if (winnerKey) {
    wins[winnerKey] = Math.max(0, (wins[winnerKey] ?? 0)) + 1;
  } else {
    totals.draws += 1;
  }

  return {
    schema: base.schema,
    updatedAt: new Date().toISOString(),
    totals,
    wins,
  };
}
