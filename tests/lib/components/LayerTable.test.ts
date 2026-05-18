import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/svelte';
import LayerTable from '../../../src/lib/components/LayerTable.svelte';
import type { Verdict } from '../../../src/lib/types.js';

const sample: Verdict = {
  date: '2026-05-18', verdict: 'GO', reason: 'all green',
  layers: {
    legal: { status: 'pass', summary: 'rockfish open' },
    safety: { status: 'pass', summary: 'thresholds met' },
    quality: { status: 'pass', summary: 'good window' },
    logistics: { status: 'pass', summary: 'Trinidad ramp' }
  },
  checks: [
    { layer: 'safety', name: 'Swell height', value: '3.5 ft', threshold: '≤ 5 ft', status: 'pass' }
  ],
  recommendations: {},
  dataSources: {
    buoy: 'not-applicable',
    nwsZone: 'missing',
    nwsPoint: 'missing'
  }
};

describe('LayerTable', () => {
  it('renders all four layer rows with summaries', () => {
    const { getByText } = render(LayerTable, { props: { verdict: sample } });
    expect(getByText('Legal')).toBeTruthy();
    expect(getByText('Safety')).toBeTruthy();
    expect(getByText('Quality')).toBeTruthy();
    expect(getByText('Logistics')).toBeTruthy();
    expect(getByText('rockfish open')).toBeTruthy();
  });
});
