import { describe, it, expect, vi } from 'vitest';
import { orchestrateVerdict } from '../../../src/lib/server/orchestrate.js';
import type { FetchedData, TidalCurrents } from '../../../src/lib/types.js';

function fakeBuoy() {
  return {
    observedAt: '2026-05-18T14:00:00Z',
    windKt: 6, gustKt: 8, windDirDeg: 270,
    waveHtFt: 3.5, dominantPeriodSec: 12, meanWaveDirDeg: 275,
    waterTempF: 52
  };
}

describe('orchestrateVerdict', () => {
  it('returns N days and freshness timestamps', async () => {
    const fetchers = {
      ndbc46244: vi.fn().mockResolvedValue({ ok: true, data: fakeBuoy(), fetchedAt: '2026-05-18T15:00:00Z' }),
      ndbc46022: vi.fn().mockResolvedValue({ ok: false, error: 'down', fetchedAt: '2026-05-18T15:00:00Z' }),
      nwsZone: vi.fn().mockResolvedValue({ ok: false, error: 'down', fetchedAt: '2026-05-18T15:00:00Z' }),
      nwsPoint: vi.fn().mockResolvedValue({ ok: false, error: 'down', fetchedAt: '2026-05-18T15:00:00Z' }),
      tides: vi.fn().mockResolvedValue({ ok: true, data: { station: '9418767', events: [] }, fetchedAt: '2026-05-18T15:00:00Z' }),
      tidalCurrents: vi.fn().mockResolvedValue(null),
      suntimes: vi.fn().mockReturnValue({ byDate: {} })
    };
    const res = await orchestrateVerdict({
      species: 'rockfish', launch: 'trinidad', days: 3, today: '2026-05-18', fetchers
    });
    expect(res.days.length).toBe(3);
    expect(res.days[0].date).toBe('2026-05-18');
    expect(res.days[1].date).toBe('2026-05-19');
    expect(res.freshness.ndbc46244).toBeTruthy();
    expect(res.freshness.ndbc46022).toBeUndefined();
  });

  it('calls suntimes with the date list', async () => {
    const sunMock = vi.fn().mockReturnValue({ byDate: {} });
    const fetchers = {
      ndbc46244: vi.fn().mockResolvedValue({ ok: false, error: 'x', fetchedAt: '' }),
      ndbc46022: vi.fn().mockResolvedValue({ ok: false, error: 'x', fetchedAt: '' }),
      nwsZone: vi.fn().mockResolvedValue({ ok: false, error: 'x', fetchedAt: '' }),
      nwsPoint: vi.fn().mockResolvedValue({ ok: false, error: 'x', fetchedAt: '' }),
      tides: vi.fn().mockResolvedValue({ ok: false, error: 'x', fetchedAt: '' }),
      tidalCurrents: vi.fn().mockResolvedValue(null),
      suntimes: sunMock
    };
    await orchestrateVerdict({ species: 'rockfish', launch: 'trinidad', days: 2, today: '2026-05-18', fetchers });
    expect(sunMock).toHaveBeenCalledWith(['2026-05-18', '2026-05-19']);
  });

  it('threads tidalCurrents into FetchedData and freshness when fetcher returns ok', async () => {
    const sample: TidalCurrents = {
      station: 'HUB0203',
      units: 'feet, knots',
      events: [
        { time: '2026-05-18T07:28', type: 'slack', velocityKt: 0, meanFloodDirDeg: 21, meanEbbDirDeg: 197 }
      ]
    };
    const currentsMock = vi.fn().mockResolvedValue({
      ok: true, data: sample, fetchedAt: '2026-05-18T15:00:00Z'
    });
    const fetchers = {
      ndbc46244: vi.fn().mockResolvedValue({ ok: false, error: 'x', fetchedAt: '' }),
      ndbc46022: vi.fn().mockResolvedValue({ ok: false, error: 'x', fetchedAt: '' }),
      nwsZone: vi.fn().mockResolvedValue({ ok: false, error: 'x', fetchedAt: '' }),
      nwsPoint: vi.fn().mockResolvedValue({ ok: false, error: 'x', fetchedAt: '' }),
      tides: vi.fn().mockResolvedValue({ ok: false, error: 'x', fetchedAt: '' }),
      tidalCurrents: currentsMock,
      suntimes: vi.fn().mockReturnValue({ byDate: {} })
    };
    const res = await orchestrateVerdict({
      species: 'surfperch', launch: 'mad-river-slough', days: 1, today: '2026-05-18', fetchers
    });
    expect(currentsMock).toHaveBeenCalled();
    expect(res.freshness.tidalCurrents).toBe('2026-05-18T15:00:00Z');
  });

  it('skips tidalCurrents (null) gracefully and leaves freshness undefined', async () => {
    const fetchers = {
      ndbc46244: vi.fn().mockResolvedValue({ ok: false, error: 'x', fetchedAt: '' }),
      ndbc46022: vi.fn().mockResolvedValue({ ok: false, error: 'x', fetchedAt: '' }),
      nwsZone: vi.fn().mockResolvedValue({ ok: false, error: 'x', fetchedAt: '' }),
      nwsPoint: vi.fn().mockResolvedValue({ ok: false, error: 'x', fetchedAt: '' }),
      tides: vi.fn().mockResolvedValue({ ok: false, error: 'x', fetchedAt: '' }),
      tidalCurrents: vi.fn().mockResolvedValue(null),
      suntimes: vi.fn().mockReturnValue({ byDate: {} })
    };
    const res = await orchestrateVerdict({
      species: 'rockfish', launch: 'trinidad', days: 1, today: '2026-05-18', fetchers
    });
    expect(res.freshness.tidalCurrents).toBeUndefined();
  });
});
