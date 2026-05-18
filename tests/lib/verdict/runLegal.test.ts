import { describe, it, expect } from 'vitest';
import { runLegal } from '../../../src/lib/verdict/runLegal.js';

describe('runLegal', () => {
  it('rockfish at trinidad open 2026-05-18 → pass', () => {
    const r = runLegal({ species: 'rockfish', launch: 'trinidad', date: '2026-05-18' });
    expect(r.result.status).toBe('pass');
    expect(r.checks.find((c) => c.name === 'Season')?.status).toBe('pass');
    expect(r.checks.find((c) => c.name === 'Species at launch')?.status).toBe('pass');
  });

  it('rockfish at trinidad closed 2026-01-15 → fail', () => {
    const r = runLegal({ species: 'rockfish', launch: 'trinidad', date: '2026-01-15' });
    expect(r.result.status).toBe('fail');
  });

  it('salmon at trinidad between Jul 19 and Aug 1 → fail (closed)', () => {
    const r = runLegal({ species: 'salmon', launch: 'trinidad', date: '2026-07-25' });
    expect(r.result.status).toBe('fail');
  });

  it('salmon at trinidad during open window adds a hotline-required check', () => {
    const r = runLegal({ species: 'salmon', launch: 'trinidad', date: '2026-06-20' });
    expect(r.result.status).toBe('pass');
    const hotline = r.checks.find((c) => c.name === 'Salmon hotline verify');
    expect(hotline).toBeDefined();
    expect(hotline!.note).toContain('707-576-3429');
  });

  it('rockfish at big-lagoon → fail (species-launch incompat)', () => {
    const r = runLegal({ species: 'rockfish', launch: 'big-lagoon', date: '2026-05-18' });
    expect(r.result.status).toBe('fail');
    const compat = r.checks.find((c) => c.name === 'Species at launch');
    expect(compat?.status).toBe('fail');
    expect(r.result.summary.toLowerCase()).toContain('big lagoon');
  });

  it('cutthroat at trinidad → fail (species-launch incompat)', () => {
    const r = runLegal({ species: 'cutthroat', launch: 'trinidad', date: '2026-05-18' });
    expect(r.result.status).toBe('fail');
    expect(r.checks.find((c) => c.name === 'Species at launch')?.status).toBe('fail');
  });

  it('surfperch at humboldt-bay-interior in season → pass', () => {
    const r = runLegal({
      species: 'surfperch',
      launch: 'humboldt-bay-interior',
      date: '2026-05-18'
    });
    expect(r.result.status).toBe('pass');
  });

  it('cutthroat at big-lagoon in March → pass', () => {
    const r = runLegal({ species: 'cutthroat', launch: 'big-lagoon', date: '2026-03-15' });
    expect(r.result.status).toBe('pass');
  });

  it('cutthroat at big-lagoon in January → pass (Big Lagoon is year-round, unlike Stone)', () => {
    const r = runLegal({ species: 'cutthroat', launch: 'big-lagoon', date: '2026-01-15' });
    expect(r.result.status).toBe('pass');
  });

  it('cutthroat at stone-lagoon in January → fail (Nov 21–Feb spawning closure)', () => {
    const r = runLegal({ species: 'cutthroat', launch: 'stone-lagoon', date: '2026-01-15' });
    expect(r.result.status).toBe('fail');
    const season = r.checks.find((c) => c.name === 'Season');
    expect(season?.status).toBe('fail');
  });

  it('cutthroat at stone-lagoon in May → pass (open during default window)', () => {
    const r = runLegal({ species: 'cutthroat', launch: 'stone-lagoon', date: '2026-05-15' });
    expect(r.result.status).toBe('pass');
  });
});
