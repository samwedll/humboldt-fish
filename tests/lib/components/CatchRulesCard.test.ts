import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import CatchRulesCard from '../../../src/lib/components/CatchRulesCard.svelte';
import { regs } from '../../../src/lib/config/regs.js';
import { idGuideForLaunch } from '../../../src/lib/config/identification.js';

const cutthroat = regs.cutthroat;

describe('CatchRulesCard', () => {
  it('compact mode shows the species and a full-rules link', () => {
    render(CatchRulesCard, {
      label: cutthroat.label, rules: cutthroat.rules, meta: cutthroat.meta,
      mode: 'compact', rulesHref: '/rules?species=cutthroat&launch=big-lagoon'
    });
    expect(screen.getByText(/what can i keep/i)).toBeInTheDocument();
    const link = screen.getByRole('link', { name: /full rules/i });
    expect(link).toHaveAttribute('href', '/rules?species=cutthroat&launch=big-lagoon');
  });

  it('full mode renders the size and bag rows', () => {
    render(CatchRulesCard, {
      label: cutthroat.label, rules: cutthroat.rules, meta: cutthroat.meta, mode: 'full'
    });
    expect(screen.getByText('SIZE')).toBeInTheDocument();
    expect(screen.getByText('KEEP')).toBeInTheDocument();
    expect(screen.getByText(/14″/)).toBeInTheDocument();
  });

  it('full mode surfaces the verify badge for historical cutthroat values', () => {
    render(CatchRulesCard, {
      label: cutthroat.label, rules: cutthroat.rules, meta: cutthroat.meta, mode: 'full'
    });
    expect(screen.getAllByRole('link').some((a) => /verify/i.test(a.textContent ?? ''))).toBe(true);
  });

  it('full mode renders the ID guide block when one is passed', () => {
    render(CatchRulesCard, {
      label: cutthroat.label, rules: cutthroat.rules, meta: cutthroat.meta, mode: 'full',
      idGuide: idGuideForLaunch('big-lagoon')
    });
    expect(screen.getByText(/which trout do i have/i)).toBeInTheDocument();
    expect(screen.getByText(/release it/i)).toBeInTheDocument();
  });
});
