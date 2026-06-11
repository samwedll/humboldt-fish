import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import DayCard from '../../../src/lib/components/DayCard.svelte';
import type { Verdict, LaunchWindow, NowVerdict } from '../../../src/lib/types.js';

function verdictWith(windows: LaunchWindow[]): Verdict {
  return {
    date: '2026-06-07',
    verdict: 'GO',
    reason: 'All four layers pass',
    layers: {
      legal: { status: 'pass', summary: 'open' },
      safety: { status: 'pass', summary: 'ok' },
      quality: { status: 'pass', summary: 'ok' },
      logistics: { status: 'pass', summary: 'bay' }
    },
    checks: [],
    recommendations: { windows },
    dataSources: { buoy: 'not-applicable', nwsZone: 'live', nwsPoint: 'live', currents: 'live' }
  };
}

describe('DayCard — suppressed launch windows', () => {
  const windows: LaunchWindow[] = [
    { label: 'Evening', launchAt: '17:20 PT', returnBy: '21:20 PT', checkInBy: '22:20 PT' },
    {
      label: 'Morning',
      launchAt: '05:43 PT',
      returnBy: '09:43 PT',
      checkInBy: '10:43 PT',
      suppressed: true,
      suppressedReason: 'ebb builds past 1.5 kt by ~07:11 PT — safe trip would be under 2 h'
    }
  ];

  it('shows the suppressed window’s reason text', () => {
    const { getByText } = render(DayCard, {
      props: {
        verdict: verdictWith(windows),
        species: 'surfperch',
        launchLabel: 'Humboldt Bay (interior)',
        mode: 'today'
      }
    });
    expect(getByText(/ebb builds past 1\.5 kt/i)).toBeTruthy();
  });

  it('conveys the unavailable status to non-visual users (not just line-through)', () => {
    const { getByText } = render(DayCard, {
      props: {
        verdict: verdictWith(windows),
        species: 'surfperch',
        launchLabel: 'Humboldt Bay (interior)',
        mode: 'today'
      }
    });
    // An sr-only "Unavailable" label is present so screen readers don't announce
    // the struck-through window as a real launch option.
    expect(getByText(/unavailable/i)).toBeTruthy();
  });

  it('all windows suppressed: renders stubs only and hides the legacy single-window line', () => {
    const v = verdictWith([
      {
        label: 'Morning',
        launchAt: '05:43 PT',
        returnBy: '09:43 PT',
        checkInBy: '10:43 PT',
        suppressed: true,
        suppressedReason: 'ebb builds past 1.5 kt by ~05:43 PT — a safe trip would be under 2 h'
      }
    ]);
    // Simulate an unmigrated/edge payload that still carries the legacy string.
    v.recommendations.window = 'Launch 05:43 PT, return by 09:43 PT (4-hour trip cap)';
    const { getByTestId, queryByText } = render(DayCard, {
      props: { verdict: v, species: 'surfperch', launchLabel: 'Humboldt Bay (interior)', mode: 'today' }
    });
    expect(getByTestId('suppressed-window')).toBeTruthy();
    // The contradictory legacy "Window:" line must not render alongside the stub.
    expect(queryByText(/^Window:/)).toBeNull();
  });

  it('offers a copy button only for the live window, not the suppressed stub', () => {
    const { queryAllByRole } = render(DayCard, {
      props: {
        verdict: verdictWith(windows),
        species: 'surfperch',
        launchLabel: 'Humboldt Bay (interior)',
        mode: 'today'
      }
    });
    const copyButtons = queryAllByRole('button', { name: /copy shore comm message/i });
    expect(copyButtons.length).toBe(1);
  });
});

describe('DayCard — time awareness', () => {
  const PT = (hhmm: string) => Date.parse(`2026-06-07T${hhmm}:00-07:00`);
  const msWindows: LaunchWindow[] = [
    {
      label: 'Morning', launchAt: '06:10 PT', returnBy: '10:10 PT', checkInBy: '11:10 PT',
      launchAtMs: PT('06:10'), returnByMs: PT('10:10'), checkInByMs: PT('11:10')
    },
    {
      label: 'Evening', launchAt: '17:00 PT', returnBy: '21:00 PT', checkInBy: '22:00 PT',
      launchAtMs: PT('17:00'), returnByMs: PT('21:00'), checkInByMs: PT('22:00')
    }
  ];

  it('today mode with nowMs: windows carry past/upcoming badges', () => {
    const { getAllByTestId } = render(DayCard, {
      props: {
        verdict: verdictWith(msWindows), species: 'surfperch',
        launchLabel: 'Humboldt Bay (interior)', mode: 'today', nowMs: PT('14:00')
      }
    });
    const badges = getAllByTestId('window-state').map((el) => el.textContent?.trim());
    expect(badges).toEqual(['▪ past', '○ upcoming']);
  });

  it('row mode never renders badges even with nowMs', () => {
    const { queryAllByTestId } = render(DayCard, {
      props: {
        verdict: verdictWith(msWindows), species: 'surfperch',
        launchLabel: 'Humboldt Bay (interior)', mode: 'row', nowMs: PT('14:00')
      }
    });
    expect(queryAllByTestId('window-state')).toHaveLength(0);
  });

  it('renders the NowStrip when a now verdict is passed', () => {
    const { getByTestId } = render(DayCard, {
      props: {
        verdict: verdictWith(msWindows), species: 'surfperch',
        launchLabel: 'Humboldt Bay (interior)', mode: 'today', nowMs: PT('14:00'),
        now: {
          verdict: 'GO', reason: 'ok', returnByMs: PT('18:00'),
          factors: [], checklist: [], staleness: { obsAgeMs: null, degraded: false }
        } satisfies NowVerdict
      }
    });
    expect(getByTestId('now-strip')).toBeTruthy();
  });

  it('badges re-derive when the nowMs prop advances (minute-tick contract)', async () => {
    const { getAllByTestId, rerender } = render(DayCard, {
      props: {
        verdict: verdictWith(msWindows), species: 'surfperch',
        launchLabel: 'Humboldt Bay (interior)', mode: 'today', nowMs: PT('14:00')
      }
    });
    expect(getAllByTestId('window-state').map((el) => el.textContent?.trim())).toEqual(['▪ past', '○ upcoming']);
    await rerender({ nowMs: PT('18:30') });
    expect(getAllByTestId('window-state').map((el) => el.textContent?.trim())).toEqual(['▪ past', '● active now']);
  });
});
