# Decision Output Template

This is the canonical output format for go/no-go decisions. Use this structure every time the skill produces a decision.

---

## Format

```
# Fishing Go/No-Go: <DATE>, <LAUNCH or "Humboldt area">

**VERDICT: <GO | CONDITIONAL | NO-GO>**
<One-line reason if not full GO>

## Conditions Summary

| Layer | Check | Reading | Threshold | Status | Notes |
|-------|-------|---------|-----------|--------|-------|
| Legal | Target species in season | <yes/no> | — | ✓/✗ | <species, regs file referenced> |
| Legal | Required cards current | <yes/unknown> | — | ✓/?/✗ | <which card> |
| Legal | Launch in/near MPA | <yes/no> | — | ✓/✗ | <MPA name if relevant> |
| Safety | Sustained wind | <X kt> | ≤10 kt launch / ≤15 kt trip | ✓/⚠/✗ | <forecast vs buoy> |
| Safety | Wind gusts | <X kt> | ≤15 kt | ✓/⚠/✗ | |
| Safety | Swell height | <X ft> | ≤5 ft | ✓/⚠/✗ | |
| Safety | Swell period | <X sec> | ≥10 sec | ✓/⚠/✗ | |
| Safety | Wind/swell direction | <aligned/opposing> | aligned within 45° | ✓/⚠/✗ | |
| Safety | Humboldt Bar status | <Open/Restricted/Closed> | Open required | ✓/✗ | <USCG advisory time> |
| Safety | Visibility | <X nm> | ≥1 nm | ✓/⚠/✗ | |
| Safety | Solo trip outside jetties? | <yes/no> | No (year 1) | ✓/✗ | |
| Quality | Tide stage at fishing window | <description> | varies by target | ✓/⚠ | <slack times> |
| Quality | Recent bite reports | <summary> | — | informational | |
| Logistics | Recommended launch | <name> | — | — | |
| Logistics | Recommended departure | <time> | — | — | <work back from slack/first light> |

## Recommended Target & Plan

- **Target species:** <species>
- **Launch:** <name> (drive time from Arcata: <X> min)
- **Depart Arcata by:** <time>
- **On the water by:** <time>
- **Off the water by:** <time>
- **Total trip duration:** <X> hours

## Gear Pack List

<Pull from gear-recommendations.md based on target species and conditions>

## Bailout Plan (if CONDITIONAL)

<What changes flip this to NO-GO. Specific triggers, not vague conditions.>

For example:
- If wind exceeds 15 kt sustained at the launch reading on arrival → don't launch
- If bar status changes to Restricted at 7am check → reroute to Trinidad inside or Bay
- If fog rolls in below 1 nm visibility before launch → wait or go inside-only

## Sources Checked

- NWS Eureka marine forecast (zone PZZ450 + PZZ410 bar): pulled <time>
- NDBC buoy 46022 (Eel River): pulled <time>
- NDBC buoy 46244 (Humboldt Bay): pulled <time>
- USCG Humboldt Bar advisory: pulled <time>
- NOAA tide station 9418767: pulled <time>
- CDFW salmon hotline (if salmon trip): <called/not called>
- Recent reports from <source>: <date of latest report>

## ⚠️ Final reminders

1. **Verify the bar status within 2 hours of launch** — conditions change fast
2. **Call (707) 576-3429 the morning of any salmon trip** — quota can close inseason
3. **File a float plan** with shore contact before leaving
4. **Test VHF on Ch 16** before paddling away from the ramp
```

---

## Status symbol conventions

- ✓ = Pass / within threshold
- ⚠ = Marginal (within 20% of failing)
- ✗ = Fail / no-go
- ? = Unknown — needs to be checked or asked of user

## Verdict logic

- **GO**: All Layer 1 ✓, all Layer 2 ✓, Layer 3 favorable, Layer 4 has a clear plan
- **CONDITIONAL**: All Layer 1 ✓, all Layer 2 ✓ or ⚠ (no ✗), Layer 3 mixed → describe bailout plan
- **NO-GO**: Any Layer 1 ✗ OR any Layer 2 ✗

If two or more Layer 2 items are ⚠, treat as CONDITIONAL with extra caution language.

If marginal AND solo AND outside-jetty → upgrade to NO-GO regardless. Year 1 rule.

---

## When to deviate from this template

- **For multi-day outlooks**: Use a compact horizontal table with each day as a column, drop the gear list, just include verdict + key drivers per day. User will ask for full detail on the day they pick.
- **For "what's in season right now" questions**: Just hit Layer 1, skip the rest, point to the relevant regs file.
- **For "should I bring X?" gear-only questions**: Skip the table entirely, go straight to gear-recommendations.md.

But for any actual go/no-go for a specific date: use the full template. Consistency makes the decisions easier to compare across trips.
