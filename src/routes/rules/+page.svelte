<script lang="ts">
  import type { Species, LaunchId } from '$lib/types.js';
  import { regs, isSpeciesOpen } from '$lib/config/regs.js';
  import { speciesLaunchCompat } from '$lib/config/species-launch.js';
  import { launches } from '$lib/config/launches.js';
  import { idGuideForLaunch } from '$lib/config/identification.js';
  import { SPECIES_LABEL } from '$lib/config/species-labels.js';
  import { parseRulesParams } from '$lib/rulesParams.js';
  import CatchRulesCard from '$lib/components/CatchRulesCard.svelte';

  // Default for the prerendered HTML; real selection is read from the URL on mount.
  let launch: LaunchId = $state('trinidad');
  let species: Species = $state(speciesLaunchCompat['trinidad'][0]);

  $effect(() => {
    const parsed = parseRulesParams(window.location.search);
    launch = parsed.launch;
    species = parsed.species;
  });

  const validSpecies = $derived(speciesLaunchCompat[launch]);
  const launchOptions = (Object.keys(launches) as LaunchId[]).map((id) => ({ id, label: launches[id].label }));
  // Device-date season check — pure date math, works offline.
  const todayISO = $derived(new Date().toISOString().slice(0, 10));
  const seasonOpen = $derived(isSpeciesOpen(species, todayISO, launch).open);
  const guide = $derived(idGuideForLaunch(launch));

  function pickSpecies(s: Species) {
    species = s;
    const qs = new URLSearchParams({ species: s, launch });
    history.replaceState({}, '', `/rules?${qs.toString()}`);
  }
  function pickLaunch(id: LaunchId) {
    launch = id;
    if (!speciesLaunchCompat[id].includes(species)) species = speciesLaunchCompat[id][0];
    const qs = new URLSearchParams({ species, launch: id });
    history.replaceState({}, '', `/rules?${qs.toString()}`);
  }
</script>

<svelte:head><title>What can I keep? · Humboldt Fish</title></svelte:head>

<main class="mx-auto max-w-xl p-3">
  <header class="mb-3 flex items-center justify-between">
    <h1 class="text-lg font-bold">What can I keep?</h1>
    <a class="rounded-full bg-surface2 px-3 py-1 text-sm text-muted underline" href={`/?species=${species}&launch=${launch}`}>← Verdict</a>
  </header>

  <select
    class="mb-2 w-full rounded-full border border-line bg-surface2 px-3 py-1 text-sm"
    value={launch}
    onchange={(e) => pickLaunch((e.currentTarget as HTMLSelectElement).value as LaunchId)}
  >
    {#each launchOptions as o}<option value={o.id}>{o.label}</option>{/each}
  </select>

  <div class="mb-3 flex flex-wrap gap-1 rounded-2xl bg-surface2 p-1 text-sm">
    {#each validSpecies as s}
      <button
        type="button"
        class={`whitespace-nowrap rounded-full px-3 py-1 ${species === s ? 'bg-accent font-semibold text-on-accent' : 'text-muted'}`}
        onclick={() => pickSpecies(s)}
      >
        {SPECIES_LABEL[s]}
      </button>
    {/each}
  </div>

  <CatchRulesCard
    label={regs[species].label}
    rules={regs[species].rules}
    meta={regs[species].meta}
    mode="full"
    {seasonOpen}
    idGuide={guide}
  />
</main>
