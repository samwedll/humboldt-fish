<script lang="ts">
  import type { Verdict, Species, DataSources } from '$lib/types.js';
  import VerdictPill from './VerdictPill.svelte';
  import LayerTable from './LayerTable.svelte';
  import { regs } from '$lib/config/regs.js';

  type Props = {
    verdict: Verdict;
    species: Species;
    mode?: 'today' | 'row';
    lowConfidence?: boolean;
  };
  let { verdict, species, mode = 'row', lowConfidence = false }: Props = $props();

  let expanded = $state(mode === 'today');

  function fmtDate(d: string): string {
    const [, m, day] = d.split('-');
    return `${Number(m)}/${Number(day)}`;
  }

  let showSalmonHotline = $derived(
    species === 'salmon' && (verdict.verdict === 'GO' || verdict.verdict === 'CONDITIONAL')
  );
  let hotline = $derived(regs.salmon.hotlinePhone);

  function toggle() { expanded = !expanded; }

  // Format a "Verdict from: ..." chip listing live sources, flagging missing ones.
  // Sources marked 'not-applicable' (e.g., buoy on a future day) are omitted entirely.
  function formatSources(ds: DataSources | undefined): { label: string; hasMissing: boolean } | null {
    if (!ds) return null;
    const live: string[] = [];
    const missing: string[] = [];
    const entries: [keyof DataSources, string][] = [
      ['buoy', 'buoy'],
      ['nwsZone', 'NWS forecast'],
      ['nwsPoint', 'point forecast'],
      ['currents', 'currents']
    ];
    for (const [key, label] of entries) {
      if (ds[key] === 'live') live.push(label);
      else if (ds[key] === 'missing') missing.push(label);
    }
    if (live.length === 0 && missing.length === 0) return null;
    let label = live.length > 0 ? `Verdict from: ${live.join(' + ')}` : 'No live sources';
    if (missing.length > 0) label += ` · missing: ${missing.join(' + ')}`;
    return { label, hasMissing: missing.length > 0 };
  }
  let sourceChip = $derived(formatSources(verdict.dataSources));

  // Pull the Logistics-layer tidal-currents check (if any) so we can surface
  // its summary as a small inline block, separate from the gear pack list.
  let tidalCurrentsCheck = $derived(
    verdict.checks.find((c) => c.name === 'Tidal currents')
  );
</script>

<article
  class={`rounded-lg border border-neutral-200 bg-white ${mode === 'today' ? 'p-4 shadow-sm' : 'p-3'} ${lowConfidence ? 'opacity-60' : ''}`}
>
  <button
    type="button"
    class="flex w-full items-center justify-between gap-2 text-left"
    aria-expanded={expanded}
    onclick={toggle}
  >
    <span class="flex items-center gap-3">
      <span class={`font-semibold ${mode === 'today' ? 'text-lg' : ''}`}>
        {mode === 'today' ? 'Today' : fmtDate(verdict.date)}
      </span>
      <VerdictPill verdict={verdict.verdict} size={mode === 'today' ? 'lg' : 'sm'} />
    </span>
    <span class="text-sm text-neutral-600 truncate">{verdict.reason}</span>
  </button>

  {#if sourceChip}
    <div
      class="mt-1 text-xs {sourceChip.hasMissing ? 'text-amber-700' : 'text-neutral-500'}"
      data-testid="source-chip"
    >
      {sourceChip.label}
    </div>
  {/if}

  {#if lowConfidence}
    <div class="mt-1 text-xs text-neutral-500 italic">Forecast confidence drops past day 5.</div>
  {/if}

  {#if expanded}
    <div class="mt-3">
      <LayerTable {verdict} />
    </div>

    {#if verdict.recommendations.window}
      <div class="mt-3 rounded bg-neutral-50 p-3 text-sm">
        <strong>Window:</strong> {verdict.recommendations.window}
      </div>
    {/if}

    {#if verdict.recommendations.bailout}
      <div class="mt-2 rounded border border-yellow-300 bg-yellow-50 p-3 text-sm">
        <strong>Bailout plan:</strong> {verdict.recommendations.bailout}
      </div>
    {/if}

    {#if tidalCurrentsCheck}
      <div
        class="mt-2 rounded border border-sky-300 bg-sky-50 p-3 text-sm"
        data-testid="tidal-currents-block"
      >
        <strong>Tidal currents:</strong>
        {#if tidalCurrentsCheck.status === 'unknown'}
          <span class="text-neutral-600">{tidalCurrentsCheck.value}</span>
        {:else}
          {tidalCurrentsCheck.value}
        {/if}
        {#if tidalCurrentsCheck.note}
          <div class="mt-1 text-xs text-neutral-600">{tidalCurrentsCheck.note}</div>
        {/if}
      </div>
    {/if}

    {#if verdict.recommendations.gear && verdict.recommendations.gear.length > 0}
      <details class="mt-2">
        <summary class="cursor-pointer text-sm font-medium">Gear pack list</summary>
        <ul class="ml-4 mt-1 list-disc text-sm text-neutral-700">
          {#each verdict.recommendations.gear as g}
            <li>{g}</li>
          {/each}
        </ul>
      </details>
    {/if}

    {#if verdict.verdict === 'GO' || verdict.verdict === 'CONDITIONAL'}
      <div class="mt-3 rounded border border-neutral-300 bg-neutral-50 p-3 text-xs text-neutral-700">
        <strong>Verify within 2 hours of launch:</strong>
        <ul class="ml-4 mt-1 list-disc">
          <li>USCG Bar status — <a class="underline" href="tel:7078396113">707-839-6113</a> or VHF 22A</li>
          {#if showSalmonHotline && hotline}
            <li><strong>Salmon hotline — must call</strong> — <a class="underline" href={`tel:${hotline.replace(/-/g, '')}`}>{hotline}</a></li>
          {/if}
        </ul>
        Conditions can change fast on the North Coast.
      </div>
    {/if}
  {/if}
</article>
