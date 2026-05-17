/**
 * Mirror of reference/thresholds.md.
 * Source of truth is the markdown file; this is the runtime copy.
 * When reference/thresholds.md changes, update this file in the same commit.
 */
export const thresholds = {
  windSustainedLaunchKt: 10,
  windSustainedTripKt: 15,
  windGustKt: 15,
  swellHeightFt: 5,
  swellPeriodSec: 10,
  windSwellAlignmentDeg: 45,
  visibilityNm: 1,
  waterTempLayeringRequiredF: 60,

  soloOutsideJettiesYearOne: 'NO-GO' as const,
  humboldtBarCrossing: 'PERMANENTLY-RULED-OUT' as const,
  openOceanLaunchesAllowed: ['trinidad'] as const,

  yearOneTripDurationHr: 4
};

export const WARN_BAND = 0.2;
