<script lang="ts">
  import type { Verdict, Species, DataSources, LaunchWindow, NowVerdict, LaunchId } from '$lib/types.js';
  import VerdictPill from './VerdictPill.svelte';
  import LayerTable from './LayerTable.svelte';
  import NowStrip from './NowStrip.svelte';
  import { regs } from '$lib/config/regs.js';
  import { windowState } from '$lib/verdict/windowState.js';
  import CatchRulesCard from './CatchRulesCard.svelte';
  import Icon from './Icon.svelte';
  import VerdictPanel from './VerdictPanel.svelte';

  type Props = {
    verdict: Verdict;
    species: Species;
    launch: LaunchId;
    launchLabel: string;
    mode?: 'today' | 'row';
    lowConfidence?: boolean;
    nowMs?: number;          // wall-clock from the page's minute tick (today mode)
    now?: NowVerdict | null; // evaluated now-verdict (today mode)
  };
  let { verdict, species, launch, launchLabel, mode = 'row', lowConfidence = false, nowMs, now = null }: Props = $props();

  const STATE_BADGE = { past: 'past', active: 'active now', upcoming: 'upcoming' } as const;

  function badgeFor(w: LaunchWindow): string | null {
    if (mode !== 'today' || nowMs === undefined) return null;
    const s = windowState(nowMs, w);
    return s ? STATE_BADGE[s] : null;
  }

  let expanded = $state(mode === 'today');
  let copiedLabel = $state<string | null>(null);

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

  // Split recommended windows into the ones the user can actually launch and the
  // suppressed stubs (kept visible, greyed, so the reason a window is gone is
  // never hidden — e.g. "morning slack is pre-dawn" / "ebb clamps trip under 2h").
  let liveWindows = $derived((verdict.recommendations.windows ?? []).filter((w) => !w.suppressed));
  let suppressedWindows = $derived(
    (verdict.recommendations.windows ?? []).filter((w) => w.suppressed)
  );

  /**
   * Compose a paste-ready float-plan message for the given window. Sam taps
   * the button, the text goes to the clipboard, and he pastes into Messages
   * or Mail to send to his shore contact.
   */
  function buildShoreMessage(w: LaunchWindow): string {
    const lines = [
      `Kayak fishing — ${verdict.date}`,
      `Launch: ${launchLabel} (${species})`,
      `On the water: ${w.launchAt}`,
      `Off the water (planned): ${w.returnBy}`,
      `On board: VHF Ch 16, PLB, full safety kit`,
      ``,
      `If no contact by ${w.checkInBy} (1 hour after planned return):`,
      `  USCG Station Humboldt Bay: 707-839-6113`,
      `  Bar reports + emergency: VHF Ch 16 / Ch 22A`
    ];
    if (species === 'salmon') {
      lines.push(`  CDFW salmon hotline: 707-576-3429`);
    }
    return lines.join('\n');
  }

  async function copyShoreMessage(w: LaunchWindow) {
    const message = buildShoreMessage(w);
    try {
      await navigator.clipboard.writeText(message);
      copiedLabel = w.label;
      setTimeout(() => {
        if (copiedLabel === w.label) copiedLabel = null;
      }, 2000);
    } catch (_e) {
      // Browser refused (rare on HTTPS + user gesture). Fall back to a prompt
      // so the user can still copy manually.
      window.prompt('Copy this shore comm message:', message);
    }
  }
</script>

<article
  class={`rounded-lg border border-line bg-surface ${mode === 'today' ? 'p-4 shadow-sm' : 'p-3'} ${lowConfidence ? 'opacity-60' : ''}`}
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
      {#if mode !== 'today'}<VerdictPill verdict={verdict.verdict} size="sm" />{/if}
    </span>
    {#if mode !== 'today'}<span class="text-sm text-muted truncate">{verdict.reason}</span>{/if}
  </button>

  {#if mode === 'today'}
    <div class="mt-3"><VerdictPanel verdict={verdict.verdict} reason={verdict.reason} /></div>
  {/if}

  {#if sourceChip}
    <div
      class="mt-1 font-mono text-xs {sourceChip.hasMissing ? 'text-verdict-conditional' : 'text-muted'}"
      data-testid="source-chip"
    >
      {sourceChip.label}
    </div>
  {/if}

  {#if lowConfidence}
    <div class="mt-1 text-xs text-muted italic">Forecast confidence drops past day 5.</div>
  {/if}

  {#if expanded}
    {#if mode === 'today' && now && nowMs !== undefined}
      <div class="mt-3">
        <NowStrip {now} {nowMs} />
      </div>
    {/if}

    <div class="mt-3">
      <LayerTable {verdict} />
    </div>

    {#if liveWindows.length > 0}
      <div class="mt-3 space-y-2">
        <div class="text-xs font-semibold uppercase tracking-wide text-muted">Recommended windows</div>
        {#each liveWindows as w}
          {@const badge = badgeFor(w)}
          <div class={`rounded bg-surface2 p-3 text-sm ${badge === STATE_BADGE.past ? 'opacity-60' : ''}`}>
            <div class="flex items-start justify-between gap-2">
              <div class="flex-1">
                <strong>{w.label}:</strong> Launch {w.launchAt}, return by {w.returnBy}
                {#if badge}
                  <span class="ml-2 inline-flex items-center gap-1 text-xs text-muted" data-testid="window-state"><span class="window-dot" aria-hidden="true"></span>{badge}</span>
                {/if}
                {#if w.tide}
                  <div class="mt-1 flex items-center gap-1 text-xs text-accent"><Icon name="tide" size={13} /> {w.tide.description}</div>
                {/if}
                {#if w.warning}
                  <div class="callout-caution mt-1 inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs">
                    <Icon name="warn" size={12} /> {w.warning}
                  </div>
                {/if}
                {#if w.rationale}
                  <div class="mt-1 text-xs text-muted">{w.rationale}</div>
                {/if}
              </div>
              <button
                type="button"
                class="shrink-0 rounded border border-line bg-surface px-2 py-1 text-xs hover:bg-surface2"
                onclick={() => copyShoreMessage(w)}
                aria-label={`Copy shore comm message for ${w.label} window`}
              >
                {#if copiedLabel === w.label}<Icon name="check" size={13} class="inline" /> Copied{:else}<Icon name="copy" size={13} class="inline" /> Copy shore msg{/if}
              </button>
            </div>
          </div>
        {/each}
      </div>
    {:else if verdict.recommendations.window && suppressedWindows.length === 0}
      <div class="mt-3 rounded bg-surface2 p-3 text-sm">
        <strong>Window:</strong> {verdict.recommendations.window}
      </div>
    {/if}

    {#if suppressedWindows.length > 0}
      <div class="mt-2 space-y-2">
        <div class="text-xs font-semibold uppercase tracking-wide text-muted">Not available</div>
        {#each suppressedWindows as w}
          {@const badge = badgeFor(w)}
          <div
            class="rounded border border-line bg-surface2 p-3 text-sm opacity-60"
            data-testid="suppressed-window"
          >
            <div>
              <strong>{w.label}:</strong>
              <!-- line-through + opacity are visual-only; sr-only conveys status to screen readers -->
              <span class="sr-only">Unavailable — </span>
              <span class="line-through">Launch {w.launchAt}, return by {w.returnBy}</span>
              {#if badge}
                <span class="ml-2 inline-flex items-center gap-1 text-xs text-muted" data-testid="window-state"><span class="window-dot" aria-hidden="true"></span>{badge}</span>
              {/if}
            </div>
            {#if w.suppressedReason}
              <div class="mt-1 text-xs text-muted">
                <Icon name="block" size={13} class="inline text-verdict-nogo" /> <span>{w.suppressedReason}</span>
              </div>
            {/if}
          </div>
        {/each}
      </div>
    {/if}

    {#if verdict.recommendations.bailout}
      <div class="callout-caution mt-2 rounded p-3 text-sm">
        <strong>Bailout plan:</strong> {verdict.recommendations.bailout}
      </div>
    {/if}

    {#if tidalCurrentsCheck}
      <div
        class="callout-info mt-2 rounded p-3 text-sm"
        data-testid="tidal-currents-block"
      >
        <strong>Tidal currents:</strong>
        {#if tidalCurrentsCheck.status === 'unknown'}
          <span class="text-muted">{tidalCurrentsCheck.value}</span>
        {:else}
          {tidalCurrentsCheck.value}
        {/if}
        {#if tidalCurrentsCheck.note}
          <div class="mt-1 text-xs text-muted">{tidalCurrentsCheck.note}</div>
        {/if}
      </div>
    {/if}

    <CatchRulesCard
      label={regs[species].label}
      rules={regs[species].rules}
      meta={regs[species].meta}
      mode="compact"
      rulesHref={`/rules?species=${species}&launch=${launch}`}
    />

    {#if verdict.recommendations.gear && verdict.recommendations.gear.length > 0}
      <details class="mt-2">
        <summary class="cursor-pointer text-sm font-medium">Gear pack list</summary>
        <ul class="ml-4 mt-1 list-disc text-sm text-muted">
          {#each verdict.recommendations.gear as g}
            <li>{g}</li>
          {/each}
        </ul>
      </details>
    {/if}

    {#if verdict.verdict === 'GO' || verdict.verdict === 'CONDITIONAL'}
      <div class="mt-3 rounded border border-line bg-surface2 p-3 text-xs text-muted">
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

<style>
  .window-dot { width: 7px; height: 7px; border-radius: 50%; background: currentColor; display: inline-block; }
</style>
