<script lang="ts">
  import type { CatchRules, RegMeta } from '$lib/config/regs.js';
  import type { IdGuide } from '$lib/config/identification.js';
  import { formatSize, formatBag, formatSubLimit } from '$lib/catchRulesView.js';
  import RegRow from './RegRow.svelte';
  import VerifyBadge from './VerifyBadge.svelte';

  type Props = {
    label: string;
    rules: CatchRules;
    meta: RegMeta;
    mode: 'compact' | 'full';
    seasonOpen?: boolean;
    idGuide?: IdGuide;
    rulesHref?: string;
  };
  let { label, rules, meta, mode, seasonOpen, idGuide, rulesHref }: Props = $props();

  const sizeText = $derived(formatSize(rules.size.value));
  const bagText = $derived(formatBag(rules.bag.value));
</script>

{#if mode === 'compact'}
  <details class="mt-3 rounded border border-neutral-300 bg-neutral-50 p-3 text-xs text-neutral-700">
    <summary class="cursor-pointer font-medium">What can I keep?</summary>
    <div class="mt-2">
      <RegRow label="SIZE" value={sizeText} confidence={rules.size.confidence} sourceUrl={meta.sourceUrl} note={rules.size.note} />
      <RegRow label="KEEP" value={bagText} confidence={rules.bag.confidence} sourceUrl={meta.sourceUrl} note={rules.bag.note} />
      {#if rules.prohibited && rules.prohibited.length > 0}
        <!-- prohibited/release entries are confirmed regulations, not uncertain data — no verify badge by design -->
        <RegRow label="RELEASE" value={rules.prohibited.join('; ')} />
      {/if}
      {#if rulesHref}
        <div class="mt-1 text-right">
          <a class="underline" href={rulesHref}>Full rules ↗</a>
        </div>
      {/if}
    </div>
  </details>
{:else}
  <section class="rounded-lg border border-neutral-300 bg-white p-4">
    <div class="flex items-baseline justify-between">
      <h2 class="text-base font-semibold text-neutral-900">{label}</h2>
      {#if seasonOpen !== undefined}
        <span class={`rounded-full px-2 py-0.5 text-xs font-medium ${seasonOpen ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
          Season: {seasonOpen ? 'OPEN' : 'CLOSED'}
        </span>
      {/if}
    </div>
    <div class="mt-2 divide-y divide-neutral-100">
      <RegRow label="SIZE" value={sizeText} confidence={rules.size.confidence} sourceUrl={meta.sourceUrl} note={rules.size.note} />
      <RegRow label="KEEP" value={bagText} confidence={rules.bag.confidence} sourceUrl={meta.sourceUrl} note={rules.bag.note} />
      {#if rules.subLimits}
        {#each rules.subLimits.value as s (s.species)}
          <RegRow label="SUB-LIMIT" value={formatSubLimit(s)} confidence={rules.subLimits.confidence} sourceUrl={meta.sourceUrl} />
        {/each}
      {/if}
      {#if rules.prohibited && rules.prohibited.length > 0}
        <!-- prohibited/release entries are confirmed regulations, not uncertain data — no verify badge by design -->
        <RegRow label="RELEASE" value={rules.prohibited.join('; ')} />
      {/if}
      {#if rules.gear}
        <RegRow label="GEAR" value={rules.gear.value.join('; ')} confidence={rules.gear.confidence} sourceUrl={meta.sourceUrl} note={rules.gear.note} />
      {/if}
      <RegRow label="LICENSE" value={rules.license.join('; ')} />
      {#if rules.otherRules}
        {#each rules.otherRules as o}
          <RegRow label="ALSO" value={o} />
        {/each}
      {/if}
    </div>

    {#if idGuide}
      <div class="mt-4 rounded-md border border-amber-300 bg-amber-50 p-3">
        <h3 class="text-sm font-semibold text-amber-900">⚠ {idGuide.title}</h3>
        <p class="mt-1 text-xs text-amber-900">{idGuide.whenUncertain}</p>
        <div class="mt-2 grid gap-2 sm:grid-cols-3">
          {#each idGuide.candidates as c (c.name)}
            <div class="rounded border border-amber-200 bg-white p-2">
              <div class="flex items-center justify-between">
                <span class="text-xs font-semibold text-neutral-900">{c.name}</span><VerifyBadge confidence={c.tells.confidence} sourceUrl={idGuide.meta.sourceUrl} />
                <span class="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] text-neutral-600">{c.origin}</span>
              </div>
              <ul class="ml-3 mt-1 list-disc text-[11px] text-neutral-700">
                {#each c.tells.value as t}<li>{t}</li>{/each}
              </ul>
              <p class="mt-1 text-[11px] font-medium text-neutral-800">{c.ruleSummary}</p>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <p class="mt-3 text-[11px] text-neutral-500">
      {meta.draft ? 'Draft' : 'Current'} · updated {meta.lastUpdated} ·
      <a class="underline" href={meta.sourceUrl} target="_blank" rel="noopener noreferrer">verify at CDFW ↗</a>
    </p>
  </section>
{/if}
