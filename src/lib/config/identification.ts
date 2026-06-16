import type { LaunchId, Species } from '../types.js';
import type { Confidence, RegMeta } from './regs.js';

export interface IdCandidate {
  name: string;
  scientific?: string;
  origin: 'wild' | 'stocked' | 'anadromous';
  tells: { value: string[]; confidence: Confidence };
  ruleSummary: string;
  rulesSpecies?: Species;
}

export interface IdGuide {
  id: string;
  title: string;
  appliesToLaunches: LaunchId[];
  candidates: IdCandidate[];
  whenUncertain: string;
  meta: RegMeta;
}

export const idGuides: IdGuide[] = [
  {
    id: 'lagoon-trout',
    title: 'Which trout do I have?',
    appliesToLaunches: ['big-lagoon', 'stone-lagoon', 'freshwater-lagoon'],
    candidates: [
      {
        name: 'Coastal cutthroat trout',
        scientific: 'Oncorhynchus clarkii clarkii',
        origin: 'wild',
        tells: {
          value: [
            'Red-orange "cutthroat" slash under each side of the lower jaw',
            'Small black spots over most of the body, including below the lateral line and onto the tail',
            'Body olive to coppery; teeth often present on the back of the tongue (basibranchial — not confirmed by CDFW page)'
          ],
          // Jaw slash and spots below lateral line confirmed via CDFW Coastal Cutthroat Trout page.
          // Basibranchial teeth mark not found on CDFW — see reference/regs/lagoon-trout-id-2026.md TODO.
          confidence: 'confirmed'
        },
        ruleSummary: '1 / day · barbless artificial lure · catch-and-release encouraged',
        rulesSpecies: 'cutthroat'
      },
      {
        name: 'Rainbow trout (stocked)',
        scientific: 'Oncorhynchus mykiss',
        origin: 'stocked',
        tells: {
          value: [
            'Broad pink-to-red band along the lateral line; no jaw slash',
            'Spots concentrated on the upper body and tail; white-to-pink mouth',
            'Stocked fish may show worn/rounded fins from the hatchery (not confirmed by CDFW page)'
          ],
          // Lateral band and spot pattern confirmed via CDFW Coastal Rainbow Trout page.
          // Worn/rounded fin mark for hatchery fish not on CDFW page — see reference/regs/lagoon-trout-id-2026.md TODO.
          confidence: 'confirmed'
        },
        ruleSummary: '5 / day (inland) · check the planting schedule',
        rulesSpecies: 'rainbow-trout'
      },
      {
        name: 'Steelhead (sea-run rainbow)',
        scientific: 'Oncorhynchus mykiss',
        origin: 'anadromous',
        tells: {
          value: [
            'A rainbow that has been to sea: bright silver, larger, faint stripe',
            'Hatchery steelhead have a CLIPPED adipose fin (healed scar behind the dorsal)',
            'Wild steelhead have an intact adipose fin and are release-only in most coastal waters'
          ],
          // Adipose-clip ID and wild-vs-hatchery retention rules NOT confirmed from CDFW pages
          // during 2026-06-15 sourcing session. See reference/regs/lagoon-trout-id-2026.md TODO.
          confidence: 'unverified'
        },
        ruleSummary: 'Wild = release-only; hatchery (clipped) per CDFW steelhead regs + report card',
        rulesSpecies: undefined
      }
    ],
    whenUncertain:
      'Cutthroat and rainbow hybridize in these lagoons, so the jaw slash is not always definitive. If you cannot positively confirm the fish, release it — coastal cutthroat is a species of conservation concern and the 1-fish limit is unforgiving.',
    meta: { lastUpdated: '2026-06-15', draft: true, sourceUrl: 'https://wildlife.ca.gov/Fishing/Inland' }
  }
];

export function idGuideForLaunch(launch: LaunchId): IdGuide | undefined {
  return idGuides.find((g) => g.appliesToLaunches.includes(launch));
}
