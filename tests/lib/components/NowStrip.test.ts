import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import NowStrip from '../../../src/lib/components/NowStrip.svelte';
import type { NowVerdict } from '../../../src/lib/types.js';

const PT = (hhmm: string) => Date.parse(`2026-06-10T${hhmm}:00-07:00`);

function goVerdict(): NowVerdict {
  return {
    verdict: 'GO',
    reason: 'Conditions verified for an immediate launch',
    returnByMs: PT('18:00'),
    launchByMs: PT('19:00'),
    factors: [
      { layer: 'safety', name: 'Swell height', value: '3.2 ft', threshold: '≤ 5 ft', status: 'pass' }
    ],
    checklist: [
      { id: 'bar-status', label: 'USCG bar status (or VHF 22A)', phone: '707-839-6113' }
    ],
    staleness: { obsAgeMs: 9 * 60_000, degraded: false },
    tideContext: 'flood building, peaks 1.2 kt at 16:00',
    footer: 'Verify the bar status and salmon hotline within 2 hours of launch. Conditions can change fast on the North Coast.'
  };
}

describe('NowStrip', () => {
  it('GO: renders launch line, checklist, and footer', () => {
    const { getByText, getByTestId } = render(NowStrip, {
      props: { now: goVerdict(), nowMs: PT('14:00') }
    });
    expect(getByTestId('now-strip')).toBeTruthy();
    expect(getByText(/return by 18:00 PT/)).toBeTruthy();
    expect(getByText(/USCG bar status/)).toBeTruthy();
    expect(getByText(/Conditions can change fast/)).toBeTruthy();
  });

  it('temporal NO-GO: renders reason and next viable time', () => {
    const now: NowVerdict = {
      verdict: 'NO-GO',
      reason: 'Not now — launch is already in a building ebb (> 1.5 kt)',
      nextViableAtMs: PT('18:00'),
      factors: [],
      checklist: [],
      staleness: { obsAgeMs: null, degraded: false }
    };
    const { getByText } = render(NowStrip, { props: { now, nowMs: PT('14:00') } });
    expect(getByText(/Not now/)).toBeTruthy();
    expect(getByText(/Viable from 18:00 PT/)).toBeTruthy();
  });

  it('degraded staleness renders the obs age with warning styling text', () => {
    const now = goVerdict();
    now.staleness = { obsAgeMs: 100 * 60_000, degraded: true };
    const { getByText } = render(NowStrip, { props: { now, nowMs: PT('14:00') } });
    expect(getByText(/1h 40m ago/)).toBeTruthy();
  });
});
