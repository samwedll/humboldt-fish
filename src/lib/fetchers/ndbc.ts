import type { NdbcObservation } from '../types.js';

const MS_PER_KT = 1 / 0.514444;
const M_PER_FT = 0.3048;

function parseField(s: string): number | null {
  const t = s.trim();
  if (t === 'MM' || t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function cToF(c: number | null): number | null {
  return c === null ? null : (c * 9) / 5 + 32;
}

export function parseNdbc(raw: string): NdbcObservation | null {
  const lines = raw.split('\n').filter((l) => l.length > 0 && !l.startsWith('#'));
  if (lines.length === 0) return null;
  const cols = lines[0].trim().split(/\s+/);
  if (cols.length < 15) return null;
  const [yr, mo, dy, hr, mn] = cols.slice(0, 5);
  const wdir = parseField(cols[5]);
  const wspdMs = parseField(cols[6]);
  const gstMs = parseField(cols[7]);
  const wvhtM = parseField(cols[8]);
  const dpd = parseField(cols[9]);
  const mwd = parseField(cols[11]);
  const wtmpC = parseField(cols[14]);

  const observedAt = `${yr}-${mo}-${dy}T${hr}:${mn}:00Z`;

  return {
    observedAt,
    windKt: wspdMs === null ? null : wspdMs * MS_PER_KT,
    gustKt: gstMs === null ? null : gstMs * MS_PER_KT,
    windDirDeg: wdir,
    waveHtFt: wvhtM === null ? null : wvhtM / M_PER_FT,
    dominantPeriodSec: dpd,
    meanWaveDirDeg: mwd,
    waterTempF: cToF(wtmpC)
  };
}

export interface FetchResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
  fetchedAt: string;
}

export async function fetchNdbc(
  url: string,
  fetchImpl: typeof fetch = fetch
): Promise<FetchResult<NdbcObservation>> {
  const fetchedAt = new Date().toISOString();
  try {
    const res = await fetchImpl(url, { headers: { 'User-Agent': 'humboldt.fish' } });
    if (!res.ok) {
      return { ok: false, error: `HTTP ${res.status}`, fetchedAt };
    }
    const text = await res.text();
    const parsed = parseNdbc(text);
    if (!parsed) {
      return { ok: false, error: 'NDBC response had no data rows', fetchedAt };
    }
    return { ok: true, data: parsed, fetchedAt };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e), fetchedAt };
  }
}
