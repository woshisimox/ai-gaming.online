export type Rating = { mu: number; sigma: number };

export const TS_DEFAULT: Rating = { mu: 25, sigma: 25 / 3 };
export const TS_BETA = 25 / 6;
export const TS_TAU = 25 / 300;
const SQRT2 = Math.sqrt(2);

const DEFAULT_SCHEMA = 'trueskill@generic.v1';

function erf(x: number) {
  const s = Math.sign(x);
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const abs = Math.abs(x);
  const t = 1 / (1 + p * abs);
  const y = 1 - (((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t) * Math.exp(-abs * abs);
  return s * y;
}

function phi(x: number) {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

function Phi(x: number) {
  return 0.5 * (1 + erf(x / SQRT2));
}

export function normalCdf(x: number) {
  return Phi(x);
}

function vExceeds(t: number) {
  const denom = Math.max(1e-12, Phi(t));
  return phi(t) / denom;
}

function wExceeds(t: number) {
  const v = vExceeds(t);
  return v * (v + t);
}

export function tsUpdateTwoTeams(ratings: Rating[], teamA: number[], teamB: number[]) {
  const varA = teamA.reduce((sum, idx) => sum + ratings[idx].sigma ** 2, 0);
  const varB = teamB.reduce((sum, idx) => sum + ratings[idx].sigma ** 2, 0);
  const muA = teamA.reduce((sum, idx) => sum + ratings[idx].mu, 0);
  const muB = teamB.reduce((sum, idx) => sum + ratings[idx].mu, 0);
  const c2 = varA + varB + 2 * TS_BETA * TS_BETA;
  const c = Math.sqrt(c2);
  const t = (muA - muB) / c;
  const v = vExceeds(t);
  const w = wExceeds(t);

  const updateTeam = (team: number[], direction: 1 | -1) => {
    for (const idx of team) {
      const sig2 = ratings[idx].sigma ** 2;
      const mult = sig2 / c;
      const mult2 = sig2 / c2;
      ratings[idx] = {
        mu: ratings[idx].mu + direction * mult * v,
        sigma: Math.sqrt(Math.max(1e-6, sig2 * (1 - w * mult2)) + TS_TAU * TS_TAU),
      };
    }
  };

  updateTeam(teamA, 1);
  updateTeam(teamB, -1);
}

export interface TrueSkillStoreEntry {
  id: string;
  label?: string;
  overall?: Rating | null;
  roles?: Record<string, Rating | null | undefined>;
  meta?: Record<string, any>;
}

export interface TrueSkillStore {
  schema: string;
  updatedAt: string;
  players: Record<string, TrueSkillStoreEntry>;
}

export function createTrueSkillStore(schema: string = DEFAULT_SCHEMA): TrueSkillStore {
  return { schema, updatedAt: new Date().toISOString(), players: {} };
}

export function ensureRating(raw: any, fallback: Rating = TS_DEFAULT): Rating {
  const mu = Number(raw?.mu);
  const sigma = Number(raw?.sigma);
  if (Number.isFinite(mu) && Number.isFinite(sigma)) {
    return { mu, sigma };
  }
  return { ...fallback };
}

export function ensureTrueSkillStore(raw: any, schema: string): TrueSkillStore {
  if (raw && typeof raw === 'object' && raw.schema === schema && raw.players) {
    return {
      schema,
      updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString(),
      players: raw.players,
    };
  }
  return createTrueSkillStore(schema);
}

export function readTrueSkillStore(key: string, schema: string): TrueSkillStore {
  if (typeof window === 'undefined') {
    return createTrueSkillStore(schema);
  }
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      return ensureTrueSkillStore(JSON.parse(raw), schema);
    }
  } catch {
    // ignore
  }
  return createTrueSkillStore(schema);
}

export function writeTrueSkillStore(key: string, store: TrueSkillStore): TrueSkillStore {
  const next: TrueSkillStore = {
    schema: store.schema,
    updatedAt: new Date().toISOString(),
    players: store.players || {},
  };
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // ignore storage errors
    }
  }
  return next;
}

export function resolveStoredRating(
  entry: TrueSkillStoreEntry | undefined,
  role?: string,
  fallback: Rating = TS_DEFAULT,
): Rating | null {
  if (!entry) return null;
  if (role && entry.roles?.[role]) {
    return ensureRating(entry.roles[role], fallback);
  }
  if (entry.overall) {
    return ensureRating(entry.overall, fallback);
  }
  const values = Object.values(entry.roles || {}).filter(Boolean) as Rating[];
  if (values.length === 0) return null;
  const mu = values.reduce((sum, r) => sum + r.mu, 0) / values.length;
  const sigma = values.reduce((sum, r) => sum + r.sigma, 0) / values.length;
  return { mu, sigma };
}

export function applyRatingsFromStore(
  store: TrueSkillStore,
  identities: Array<{ id: string; role?: string }>,
  fallback: Rating = TS_DEFAULT,
): Rating[] {
  return identities.map(({ id, role }) => {
    const entry = store.players[id];
    return resolveStoredRating(entry, role, fallback) || { ...fallback };
  });
}

export function importTrueSkillArchive(jsonText: string, schema: string): TrueSkillStore {
  const store = createTrueSkillStore(schema);
  try {
    const data = JSON.parse(jsonText);
    const consume = (entry: any) => {
      if (!entry || typeof entry !== 'object') return;
      const id = entry.id || entry.identity || entry.key;
      if (!id) return;
      store.players[id] = {
        id,
        label: entry.label,
        overall: entry.overall || entry.rating || null,
        roles: entry.roles || entry.roleRatings || {
          landlord: entry.landlord ?? entry.L ?? null,
          farmer: entry.farmer ?? entry.F ?? null,
        },
        meta: entry.meta || {},
      };
    };

    if (Array.isArray(data?.players)) {
      for (const entry of data.players) consume(entry);
    } else if (Array.isArray(data)) {
      for (const entry of data) consume(entry);
    } else if (data?.players && typeof data.players === 'object') {
      for (const id of Object.keys(data.players)) {
        store.players[id] = data.players[id];
      }
    } else if (data?.id) {
      consume(data);
    }
  } catch {
    return store;
  }
  return store;
}

export function formatTrueSkillArchiveName(prefix: string): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const tag = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(
    d.getMinutes(),
  )}${pad(d.getSeconds())}`;
  return `${prefix}_${tag}.json`;
}
