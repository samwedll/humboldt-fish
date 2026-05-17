<script lang="ts">
  import type { Species, LaunchId, VerdictResponse } from '$lib/types.js';
  import DayCard from '$lib/components/DayCard.svelte';
  import { launches, getLaunch } from '$lib/config/launches.js';
  import { speciesLaunchCompat } from '$lib/config/species-launch.js';
  import { SPECIES_LABEL } from '$lib/config/species-labels.js';

  type Data = { error: string | null; response: VerdictResponse | null };
  let { data }: { data: Data } = $props();

  function initialLaunch(): LaunchId {
    if (typeof window === 'undefined') return 'trinidad';
    const q = new URLSearchParams(window.location.search).get('launch');
    if (q && q in launches) return q as LaunchId;
    return 'trinidad';
  }

  function initialSpecies(launchId: LaunchId): Species {
    const valid = speciesLaunchCompat[launchId];
    if (typeof window === 'undefined') return valid[0];
    const q = new URLSearchParams(window.location.search).get('species') as Species | null;
    if (q && (valid as readonly Species[]).includes(q)) return q;
    return valid[0];
  }

  const startLaunch = initialLaunch();
  let launch: LaunchId = $state(startLaunch);
  let species: Species = $state(initialSpecies(startLaunch));
  let validSpecies = $derived(speciesLaunchCompat[launch]);
  let launchLabel = $derived(getLaunch(launch).label);

  let refreshing = $state(false);
  let response = $state<VerdictResponse | null>(data.response);
  let pageError = $state<string | null>(data.error);

  async function reload(extra: { refresh?: boolean } = {}) {
    refreshing = true;
    pageError = null;
    try {
      const qs = new URLSearchParams({ species, launch, days: '7' });
      if (extra.refresh) qs.set('refresh', 'true');
      const res = await fetch(`/api/verdict?${qs.toString()}`);
      if (res.ok) {
        response = await res.json();
      } else {
        pageError = `Verdict service returned ${res.status}`;
      }
    } catch (e) {
      pageError = e instanceof Error ? e.message : String(e);
    } finally {
      refreshing = false;
    }
  }

  function syncUrl() {
    const qs = new URLSearchParams(window.location.search);
    qs.set('species', species);
    qs.set('launch', launch);
    history.replaceState({}, '', `?${qs.toString()}`);
  }

  async function setSpecies(s: Species) {
    species = s;
    syncUrl();
    await reload();
  }

  async function setLaunch(l: LaunchId) {
    launch = l;
    // If current species isn't valid for new launch, switch to the first valid one
    const valid = speciesLaunchCompat[l];
    if (!(valid as readonly Species[]).includes(species)) {
      species = valid[0];
    }
    syncUrl();
    await reload();
  }

  async function refresh() {
    await reload({ refresh: true });
  }

  let days = $derived(response?.days ?? []);
  let today = $derived(days[0]);
  let rest = $derived(days.slice(1));

  function ago(iso: string | undefined): string {
    if (!iso) return 'unavailable';
    const ms = Date.now() - Date.parse(iso);
    const min = Math.round(ms / 60000);
    if (min < 60) return `${min} min ago`;
    return `${Math.round(min / 60)} h ago`;
  }

  const STALE_THRESHOLDS_MIN: Record<string, number> = {
    ndbc46244: 20, ndbc46022: 20, nwsZone: 120, nwsPoint: 120, tides: 2880
  };
  function isStale(iso: string | undefined, key: keyof typeof STALE_THRESHOLDS_MIN): boolean {
    if (!iso) return false;
    const minOld = (Date.now() - Date.parse(iso)) / 60000;
    return minOld > STALE_THRESHOLDS_MIN[key];
  }

  const LAUNCH_OPTIONS: { id: LaunchId; label: string }[] = (Object.keys(launches) as LaunchId[])
    .map((id) => ({ id, label: getLaunch(id).label }));
</script>

<svelte:head>
  <title>humboldt.fish — go / no-go</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</svelte:head>

<main class="mx-auto max-w-2xl p-3">
  <header class="sticky top-0 z-10 -mx-3 mb-3 flex items-center gap-2 bg-white/95 px-3 py-2 backdrop-blur border-b border-neutral-200">
    <div
      class="flex min-w-0 flex-1 gap-1 overflow-x-auto rounded-full bg-neutral-100 p-1 text-sm [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {#each validSpecies as s}
        <button
          type="button"
          class={`shrink-0 whitespace-nowrap px-3 py-1 rounded-full ${species === s ? 'bg-white shadow font-semibold' : 'text-neutral-600'}`}
          onclick={() => setSpecies(s)}
        >
          {SPECIES_LABEL[s]}
        </button>
      {/each}
    </div>
    <select
      class="shrink-0 rounded-full border border-neutral-200 bg-neutral-100 px-2 py-1 text-xs text-neutral-700"
      value={launch}
      onchange={(e) => setLaunch((e.currentTarget as HTMLSelectElement).value as LaunchId)}
    >
      {#each LAUNCH_OPTIONS as o}
        <option value={o.id}>{o.label}</option>
      {/each}
    </select>
    <button
      type="button"
      class="shrink-0 rounded-full bg-neutral-100 px-3 py-1 text-sm"
      onclick={refresh}
      disabled={refreshing}
    >
      {refreshing ? '…' : '↻'}
    </button>
  </header>

  <aside class="mb-3 rounded border border-red-300 bg-red-50 p-3 text-xs leading-snug text-red-800">
    <strong>Not for general use.</strong>
    Thresholds and decision logic are calibrated for a specific boat type, layering system, and skill level — not transferable defaults for any other boat, gear, or experience level. This site does not replace USCG bar status (<a class="underline" href="tel:7078396113">707-839-6113</a> or VHF 22A), the CDFW salmon hotline (<a class="underline" href="tel:7075763429">707-576-3429</a>), or on-the-water judgment at the launch ramp.
  </aside>

  {#if pageError}
    <div class="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
      Could not load verdicts: {pageError}. Verify NOAA directly via <a class="underline" href="tel:7078396113">USCG 707-839-6113</a> or VHF 22A.
    </div>
  {:else if today}
    <DayCard verdict={today} {species} mode="today" />

    <h2 class="mt-5 mb-2 text-sm font-medium uppercase tracking-wide text-neutral-500">Next days</h2>
    <div class="space-y-2">
      {#each rest as v, i}
        <DayCard verdict={v} {species} mode="row" lowConfidence={i >= 4} />
      {/each}
    </div>

    <footer class="mt-6 border-t border-neutral-200 pt-3 text-xs text-neutral-500">
      <p>Data freshness:</p>
      <ul class="mt-1 space-y-0.5">
        <li class={isStale(response?.freshness.ndbc46244, 'ndbc46244') ? 'text-red-600' : ''}>Buoy 46244: {ago(response?.freshness.ndbc46244)}</li>
        <li class={isStale(response?.freshness.nwsZone, 'nwsZone') ? 'text-red-600' : ''}>NWS PZZ450: {ago(response?.freshness.nwsZone)}</li>
        <li class={isStale(response?.freshness.nwsPoint, 'nwsPoint') ? 'text-red-600' : ''}>NWS point ({launchLabel}): {ago(response?.freshness.nwsPoint)}</li>
        <li class={isStale(response?.freshness.tides, 'tides') ? 'text-red-600' : ''}>Tides 9418767: {ago(response?.freshness.tides)}</li>
      </ul>
      <p class="mt-3">
        Thresholds and decision logic:
        <a class="underline" href="https://github.com/samwedll/humboldt-fish/tree/main/reference">reference/ on GitHub</a>
      </p>
    </footer>
  {/if}
</main>
