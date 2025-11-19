export const DDZ_LADDER_KEY = 'ddz_ladder_store_v1';

export type DdzLadderPlayer = {
  id: string;
  label: string;
  deltaR: number;
  matches: number;
};

type RawLadderStore = {
  schema?: string;
  updatedAt?: string;
  players?: Record<
    string,
    {
      id?: string;
      label?: string;
      current?: { deltaR?: number; matches?: number; n?: number };
    }
  >;
};

function getStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function displayDdzParticipantLabel(raw: string | null | undefined): string {
  if (!raw) return '';
  const trimmed = String(raw).trim();
  if (!trimmed) return '';
  const colonIdx = trimmed.indexOf(':');
  if (colonIdx > 0) {
    const beforeColon = trimmed.slice(0, colonIdx).trim();
    if (beforeColon) return beforeColon;
  }
  const dotIdx = trimmed.indexOf('·');
  if (dotIdx > 0) {
    const beforeDot = trimmed.slice(0, dotIdx).trim();
    if (beforeDot) return beforeDot;
  }
  return trimmed;
}

export function readDdzLadderPlayers(): DdzLadderPlayer[] {
  const storage = getStorage();
  if (!storage) return [];
  try {
    const raw = storage.getItem(DDZ_LADDER_KEY);
    if (!raw) return [];
    const parsed: RawLadderStore = JSON.parse(raw) || {};
    const players = parsed.players || {};
    return Object.keys(players).map((id) => {
      const entry = players[id] || {};
      const current = entry.current || {};
      const matchesValue = (() => {
        const direct = Number(current.matches);
        if (Number.isFinite(direct)) return Math.max(0, direct);
        const fallback = Number(current.n);
        if (Number.isFinite(fallback)) return Math.max(0, Math.round(fallback));
        return 0;
      })();
      return {
        id,
        label: entry.label || id,
        deltaR: Number(current.deltaR) || 0,
        matches: matchesValue,
      };
    });
  } catch {
    return [];
  }
}

export function computeDdzTotalMatches(players: DdzLadderPlayer[]): { totalMatches: number; playerGameSum: number } {
  const totalPlayerGames = players.reduce((sum, player) => {
    const value = Number(player.matches);
    return sum + (Number.isFinite(value) && value > 0 ? value : 0);
  }, 0);
  const totalMatches = totalPlayerGames > 0 ? Math.max(0, Math.round(totalPlayerGames / 3)) : 0;
  return { totalMatches, playerGameSum: totalPlayerGames };
}
