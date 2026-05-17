import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('project scaffolding', () => {
  it('package.json declares required deps', () => {
    const pkg = JSON.parse(readFileSync(resolve('package.json'), 'utf-8'));
    expect(pkg.devDependencies['@sveltejs/adapter-cloudflare']).toBeTruthy();
    expect(pkg.devDependencies['tailwindcss']).toBeTruthy();
    expect(pkg.devDependencies['vitest']).toBeTruthy();
    expect(pkg.dependencies['zod']).toBeTruthy();
    expect(pkg.dependencies['suncalc']).toBeTruthy();
  });
});
