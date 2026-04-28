import type { CrsStep } from "./crsTest";

const STORAGE_KEY = "r2f.crs.recovery";
const SCHEMA_VERSION = 1;

export type CrsRecoveryState = {
  version: number;
  clientUuid: string;
  testId: string | null;
  step: CrsStep;
  accepted: boolean;
};

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isCrsStep(value: unknown): value is CrsStep {
  if (!value || typeof value !== "object") return false;
  const kind = (value as { kind?: unknown }).kind;
  switch (kind) {
    case "disclaimer":
    case "cooldown":
    case "result":
      return true;
    case "warmup": {
      const round = (value as { round?: unknown }).round;
      return round === 0 || round === 1 || round === 2;
    }
    case "exercise": {
      const idx = (value as { index?: unknown }).index;
      const phase = (value as { phase?: unknown }).phase;
      const validIdx = idx === 0 || idx === 1 || idx === 2 || idx === 3 || idx === 4;
      const validPhase = phase === "countdown" || phase === "input";
      return validIdx && validPhase;
    }
    default:
      return false;
  }
}

export function loadCrsRecovery(): CrsRecoveryState | null {
  const storage = getStorage();
  if (!storage) return null;
  const raw = storage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const obj = parsed as Record<string, unknown>;
    if (obj.version !== SCHEMA_VERSION) return null;
    if (typeof obj.clientUuid !== "string" || obj.clientUuid.length === 0) return null;
    if (obj.testId !== null && typeof obj.testId !== "string") return null;
    if (typeof obj.accepted !== "boolean") return null;
    if (!isCrsStep(obj.step)) return null;
    return {
      version: SCHEMA_VERSION,
      clientUuid: obj.clientUuid,
      testId: obj.testId,
      step: obj.step,
      accepted: obj.accepted,
    };
  } catch {
    return null;
  }
}

export function saveCrsRecovery(state: Omit<CrsRecoveryState, "version">): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: SCHEMA_VERSION, ...state }));
  } catch {
    // Quota / SecurityError: Recovery ist Best-Effort.
  }
}

export function clearCrsRecovery(): void {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function newCrsClientUuid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  // Fallback: extrem unwahrscheinlich in modernen Browsern, aber SSR/Tests.
  return `crs-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
