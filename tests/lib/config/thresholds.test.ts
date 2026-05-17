import { describe, it, expect } from 'vitest';
import { thresholds, WARN_BAND } from '../../../src/lib/config/thresholds.js';

describe('thresholds (matches reference/thresholds.md)', () => {
  it('sustained wind during trip ≤ 15 kt', () => { expect(thresholds.windSustainedTripKt).toBe(15); });
  it('sustained wind at launch ≤ 10 kt', () => { expect(thresholds.windSustainedLaunchKt).toBe(10); });
  it('wind gust ≤ 15 kt', () => { expect(thresholds.windGustKt).toBe(15); });
  it('swell height ≤ 5 ft', () => { expect(thresholds.swellHeightFt).toBe(5); });
  it('swell period ≥ 10 sec', () => { expect(thresholds.swellPeriodSec).toBe(10); });
  it('wind/swell direction alignment within 45°', () => { expect(thresholds.windSwellAlignmentDeg).toBe(45); });
  it('visibility ≥ 1 nm', () => { expect(thresholds.visibilityNm).toBe(1); });
  it('warn band is 20% of fail', () => { expect(WARN_BAND).toBe(0.2); });
  it('solo outside jetties is permanently no-go in year 1', () => { expect(thresholds.soloOutsideJettiesYearOne).toBe('NO-GO'); });
});
