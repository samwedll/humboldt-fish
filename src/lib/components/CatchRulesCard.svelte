<script lang="ts">
  import type { CatchRules, RegMeta } from '$lib/config/regs.js';
  import type { IdGuide } from '$lib/config/identification.js';
  import { formatSize, formatBag, formatSubLimit } from '$lib/catchRulesView.js';
  import RegRow from './RegRow.svelte';
  import VerifyBadge from './VerifyBadge.svelte';
  import Icon from './Icon.svelte';

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
  <details class="mt-3 rounded border border-line bg-surface2 p-3 text-xs text-muted">
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
  <section class="rounded-lg border border-line bg-surface p-4">
    <div class="flex items-baseline justify-between">
      <h2 class="text-base font-semibold text-ink">{label}</h2>
      {#if seasonOpen !== undefined}
        <span class={`rounded-full bg-surface2 px-2 py-0.5 text-xs font-medium ${seasonOpen ? 'text-verdict-go' : 'text-verdict-nogo'}`}>
          Season: {seasonOpen ? 'OPEN' : 'CLOSED'}
        </span>
      {/if}
    </div>
    <div class="mt-2 divide-y divide-line">
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
        {#each rules.otherRules as o (o)}
          <RegRow label="ALSO" value={o} />
        {/each}
      {/if}
    </div>

    {#if idGuide}
      <div class="callout-caution mt-4 rounded-md p-3">
        <h3 class="flex items-center gap-1 text-sm font-semibold"><Icon name="warn" size={14} class="text-verdict-conditional" /> {idGuide.title}</h3>
        <p class="mt-1 text-xs text-muted">{idGuide.whenUncertain}</p>
        <div class="mt-2 grid gap-2 sm:grid-cols-3">
          {#each idGuide.candidates as c (c.name)}
            <div class="rounded border border-line bg-surface p-2">
              <div class="flex items-start justify-between gap-2">
                <span class="flex flex-wrap items-center gap-1"><span class="text-xs font-semibold text-ink">{c.name}</span><VerifyBadge confidence={c.tells.confidence} sourceUrl={idGuide.meta.sourceUrl} /></span>
                <span class="shrink-0 rounded-full bg-surface2 px-1.5 py-0.5 text-[10px] text-muted">{c.origin}</span>
              </div>
              <ul class="ml-3 mt-1 list-disc text-[11px] text-muted">
                {#each c.tells.value as t (t)}<li>{t}</li>{/each}
              </ul>
              <p class="mt-1 text-[11px] font-medium text-ink">{c.ruleSummary}</p>
            </div>
          {/each}
        </div>
      </div>
    {/if}

    <p class="mt-3 text-[11px] text-muted">
      {meta.draft ? 'Draft' : 'Current'} · updated {meta.lastUpdated} ·
      <a class="underline" href={meta.sourceUrl} target="_blank" rel="noopener noreferrer">verify at CDFW ↗</a>
    </p>
  </section>
{/if}
