export interface LatencyPlayerStats {
  mean: number;
  count: number;
  label?: string;
}

export interface LatencyStore {
  schema: string;
  updatedAt: string;
  players: Record<string, LatencyPlayerStats>;
}

const DEFAULT_SCHEMA = 'latency@generic.v1';

export function ensureLatencyPlayer(raw: any): LatencyPlayerStats {
  const meanRaw = Number(raw?.mean);
  const countRaw = Number(raw?.count);
  const labelRaw = typeof raw?.label === 'string' ? raw.label : undefined;
  const label = labelRaw ? labelRaw.slice(0, 160) : undefined;
  return {
    mean: Number.isFinite(meanRaw) ? meanRaw : 0,
    count: Number.isFinite(countRaw) && countRaw >= 0 ? countRaw : 0,
    ...(label ? { label } : {}),
  };
}

export function ensureLatencyStore(raw: any, schema: string = DEFAULT_SCHEMA): LatencyStore {
  if (raw && typeof raw === 'object' && raw.schema === schema && raw.players) {
    const players: Record<string, LatencyPlayerStats> = {};
    for (const key of Object.keys(raw.players)) {
      players[key] = ensureLatencyPlayer(raw.players[key]);
    }
    return {
      schema,
      updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString(),
      players,
    };
  }
  return { schema, updatedAt: new Date().toISOString(), players: {} };
}

export function readLatencyStore(key: string, schema: string = DEFAULT_SCHEMA): LatencyStore {
  if (typeof window === 'undefined') {
    return { schema, updatedAt: new Date().toISOString(), players: {} };
  }
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      return ensureLatencyStore(JSON.parse(raw), schema);
    }
  } catch {
    // ignore
  }
  return { schema, updatedAt: new Date().toISOString(), players: {} };
}

export function writeLatencyStore(key: string, store: LatencyStore): LatencyStore {
  const base = ensureLatencyStore(store, store.schema);
  const next: LatencyStore = { ...base, updatedAt: new Date().toISOString() };
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function updateLatencyStats(
  prev: LatencyPlayerStats | undefined,
  sampleMs: number,
  label?: string,
): LatencyPlayerStats {
  const safePrev = ensureLatencyPlayer(prev);
  const nextCount = safePrev.count + 1;
  const nextMean = (safePrev.mean * safePrev.count + sampleMs) / Math.max(1, nextCount);
  return {
    ...safePrev,
    mean: nextMean,
    count: nextCount,
    ...(label ? { label } : {}),
  };
}
