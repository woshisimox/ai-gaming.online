export type Serializer<T> = (value: T) => any;
export type Deserializer<T> = (raw: any) => T;

const defaultSerializer = <T>(value: T) => value;
const defaultDeserializer = <T>(raw: any) => raw as T;

export function readPlayerConfigs<T>(
  storageKey: string,
  fallback: () => T[],
  deserialize: Deserializer<T> = defaultDeserializer,
): T[] {
  if (typeof window === 'undefined') {
    return fallback();
  }
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map(deserialize);
      }
    }
  } catch {
    // ignore corrupted payloads
  }
  return fallback();
}

export function writePlayerConfigs<T>(
  storageKey: string,
  entries: T[],
  serialize: Serializer<T> = defaultSerializer,
) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(storageKey, JSON.stringify(entries.map(serialize)));
  } catch {
    // ignore quota errors
  }
}

export function readConfigState<T>(
  storageKey: string,
  fallback: () => T,
  deserialize: Deserializer<T> = defaultDeserializer,
): T {
  if (typeof window === 'undefined') {
    return fallback();
  }
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw) {
      return deserialize(JSON.parse(raw));
    }
  } catch {
    // ignore invalid payloads
  }
  return fallback();
}

export function writeConfigState<T>(
  storageKey: string,
  value: T,
  serialize: Serializer<T> = defaultSerializer,
) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(storageKey, JSON.stringify(serialize(value)));
  } catch {
    // ignore quota errors
  }
}
