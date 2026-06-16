<script lang="ts">
  import type { Species, LaunchId, VerdictResponse } from '$lib/types.js';
  import DayCard from '$lib/components/DayCard.svelte';
  import { evaluateNow } from '$lib/verdict/evaluateNow.js';
  import { launches, getLaunch } from '$lib/config/launches.js';
  import { speciesLaunchCompat } from '$lib/config/species-launch.js';
  import { SPECIES_LABEL } from '$lib/config/species-labels.js';
  import Icon from '$lib/components/Icon.svelte';
  import ThemeToggle from '$lib/components/ThemeToggle.svelte';

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

  // Wall-clock for the Today card's time-awareness. A minute tick re-derives
  // the now-verdict and window badges from data already in memory — no network.
  // visibilitychange corrects instantly when the tab refocuses after a sleep.
  let nowMs = $state(Date.now());
  $effect(() => {
    const tick = setInterval(() => (nowMs = Date.now()), 60_000);
    const onVis = () => {
      if (document.visibilityState === 'visible') nowMs = Date.now();
    };
    document.addEventListener('visibilitychange', onVis);
    return () => {
      clearInterval(tick);
      document.removeEventListener('visibilitychange', onVis);
    };
  });

  let nowVerdict = $derived(today ? evaluateNow(nowMs, today, { launch, species }) : null);
  // evaluateNow returns null on a date mismatch — if nowData exists but the
  // verdict is null, the tab crossed midnight PT on a stale payload.
  let rolledOver = $derived(!!today?.nowData && nowVerdict === null);

  function ago(iso: string | undefined): string {
    if (!iso) return 'unavailable';
    const ms = Date.now() - Date.parse(iso);
    const min = Math.round(ms / 60000);
    if (min < 60) return `${min} min ago`;
    return `${Math.round(min / 60)} h ago`;
  }

  const STALE_THRESHOLDS_MIN: Record<string, number> = {
    ndbc46244: 20, ndbc46022: 20, nwsZone: 120, nwsPoint: 120, tides: 2880, tidalCurrents: 2880
  };
  function isStale(iso: string | undefined, key: keyof typeof STALE_THRESHOLDS_MIN): boolean {
    if (!iso) return false;
    const minOld = (Date.now() - Date.parse(iso)) / 60000;
    return minOld > STALE_THRESHOLDS_MIN[key];
  }

  const LAUNCH_OPTIONS: { id: LaunchId; label: string }[] = (Object.keys(launches) as LaunchId[])
    .map((id) => ({ id, label: getLaunch(id).label }));

  // Public URLs for each data source so users can tap to verify directly.
  const SOURCE_URLS = {
    ndbc46244: 'https://www.ndbc.noaa.gov/station_page.php?station=46244',
    nwsZone: 'https://forecast.weather.gov/shmrn.php?mz=pzz450',
    tides: 'https://tidesandcurrents.noaa.gov/noaatidepredictions.html?id=9418767'
  };
  let launchCoords = $derived(getLaunch(launch).coordinates);
  let currentStation = $derived(getLaunch(launch).currentStation);
  let nwsPointUrl = $derived(
    `https://forecast.weather.gov/MapClick.php?lat=${launchCoords.lat}&lon=${launchCoords.lon}`
  );
  let currentsUrl = $derived(
    currentStation
      ? `https://tidesandcurrents.noaa.gov/noaacurrents/Predictions?id=${currentStation}`
      : null
  );
</script>

<svelte:head>
  <title>humboldt.fish — go / no-go</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</svelte:head>

<main class="mx-auto max-w-2xl p-3">
  <header class="sticky top-0 z-10 -mx-3 mb-3 flex flex-wrap items-center gap-2 border-b border-line bg-chrome px-3 py-2 text-on-chrome backdrop-blur">
    <a href="/" class="flex items-center gap-2 font-extrabold tracking-tight text-on-chrome" data-sveltekit-preload-data="hover">
      <img src="/logo.svg" alt="" class="h-6 w-6 rounded" />
      <span>humboldt<span class="text-accent">.fish</span></span>
    </a>
    <div class="ml-auto"><ThemeToggle /></div>
    <div class="flex w-full flex-wrap gap-1 rounded-2xl bg-black/20 p-1 text-sm">
      {#each validSpecies as s}
        <button
          type="button"
          class={`whitespace-nowrap rounded-full px-3 py-1 ${species === s ? 'bg-accent font-semibold text-on-accent' : 'text-on-chrome/70'}`}
          onclick={() => setSpecies(s)}
        >
          {SPECIES_LABEL[s]}
        </button>
      {/each}
    </div>
    <select
      class="rounded-full border border-line bg-black/20 px-2 py-1 text-xs text-on-chrome"
      value={launch}
      onchange={(e) => setLaunch((e.currentTarget as HTMLSelectElement).value as LaunchId)}
    >
      {#each LAUNCH_OPTIONS as o}
        <option value={o.id}>{o.label}</option>
      {/each}
    </select>
    <a href={`/rules?species=${species}&launch=${launch}`} class="rounded-full bg-black/20 px-3 py-1 text-sm text-on-chrome" data-sveltekit-preload-data="hover">Rules</a>
    <button
      type="button"
      class="ml-auto rounded-full bg-black/20 px-3 py-1 text-sm text-on-chrome"
      onclick={refresh}
      disabled={refreshing}
      aria-label="Refresh"
    >
      {#if refreshing}…{:else}<Icon name="refresh" size={16} />{/if}
    </button>
  </header>

  <aside class="callout-danger mb-3 rounded p-3 text-xs leading-snug">
    <strong>Not for general use.</strong>
    Thresholds and decision logic are calibrated for a specific boat type, layering system, and skill level — not transferable defaults for any other boat, gear, or experience level. This site does not replace USCG bar status (<a class="underline" href="tel:7078396113">707-839-6113</a> or VHF 22A), the CDFW salmon hotline (<a class="underline" href="tel:7075763429">707-576-3429</a>), or on-the-water judgment at the launch ramp.
  </aside>

  {#if pageError}
    <div class="callout-danger rounded p-3 text-sm">
      Could not load verdicts: {pageError}. Verify NOAA directly via <a class="underline" href="tel:7078396113">USCG 707-839-6113</a> or VHF 22A.
    </div>
  {:else if today}
    {#if rolledOver}
      <div class="callout-caution mb-2 rounded p-3 text-sm">
        This page was computed for {today?.date} and it's now past midnight —
        <button type="button" class="underline" onclick={refresh}>refresh</button> for current verdicts.
      </div>
    {/if}
    <DayCard verdict={today} {species} {launch} {launchLabel} mode="today" {nowMs} now={nowVerdict} />

    <h2 class="mt-5 mb-2 text-sm font-medium uppercase tracking-wide text-muted">Next days</h2>
    <div class="space-y-2">
      {#each rest as v, i}
        <DayCard verdict={v} {species} {launch} {launchLabel} mode="row" lowConfidence={i >= 4} />
      {/each}
    </div>

    <footer class="mt-6 border-t border-line pt-3 text-xs text-muted">
      <p><Icon name="info" size={12} class="mr-1 inline" />Data freshness (tap a source to verify directly):</p>
      <ul class="mt-1 space-y-0.5">
        <li class={isStale(response?.freshness.ndbc46244, 'ndbc46244') ? 'text-verdict-nogo' : ''}>
          <a class="underline" href={SOURCE_URLS.ndbc46244} target="_blank" rel="noopener">Buoy 46244</a>: {ago(response?.freshness.ndbc46244)}
        </li>
        <li class={isStale(response?.freshness.nwsZone, 'nwsZone') ? 'text-verdict-nogo' : ''}>
          <a class="underline" href={SOURCE_URLS.nwsZone} target="_blank" rel="noopener">NWS PZZ450</a>: {ago(response?.freshness.nwsZone)}
        </li>
        <li class={isStale(response?.freshness.nwsPoint, 'nwsPoint') ? 'text-verdict-nogo' : ''}>
          <a class="underline" href={nwsPointUrl} target="_blank" rel="noopener">NWS point ({launchLabel})</a>: {ago(response?.freshness.nwsPoint)}
        </li>
        <li class={isStale(response?.freshness.tides, 'tides') ? 'text-verdict-nogo' : ''}>
          <a class="underline" href={SOURCE_URLS.tides} target="_blank" rel="noopener">Tides 9418767</a>: {ago(response?.freshness.tides)}
        </li>
        {#if currentsUrl}
          <li class={isStale(response?.freshness.tidalCurrents, 'tidalCurrents') ? 'text-verdict-nogo' : ''}>
            <a class="underline" href={currentsUrl} target="_blank" rel="noopener">Tidal currents ({currentStation})</a>: {ago(response?.freshness.tidalCurrents)}
          </li>
        {/if}
      </ul>
      <p class="mt-3 italic text-muted">
        Times shown in Pacific time (PT). Verdicts apply Humboldt-specific thresholds — see <a class="underline" href="https://github.com/samwedll/humboldt-fish/tree/main/reference">reference/ on GitHub</a> for the source of truth.
      </p>
    </footer>
  {/if}
</main>
