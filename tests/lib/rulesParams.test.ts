import { describe, it, expect } from 'vitest';
import { parseRulesParams } from '../../src/lib/rulesParams.js';

describe('parseRulesParams', () => {
  it('reads a valid species + launch', () => {
    expect(parseRulesParams('?species=cutthroat&launch=big-lagoon'))
      .toEqual({ launch: 'big-lagoon', species: 'cutthroat' });
  });
  it('falls back to trinidad for an unknown launch', () => {
    expect(parseRulesParams('?launch=narnia').launch).toBe('trinidad');
  });
  it('falls back to the first compatible species when species is incompatible with launch', () => {
    // salmon is not compatible with big-lagoon → first valid species there is cutthroat
    expect(parseRulesParams('?species=salmon&launch=big-lagoon').species).toBe('cutthroat');
  });
  it('defaults both when empty', () => {
    const r = parseRulesParams('');
    expect(r.launch).toBe('trinidad');
    expect(r.species).toBe('rockfish');
  });
});
