// api/_prompt.js
// Single source of truth for the DialedMX suspension tuning system prompt.
// Both generate.js (free tier) and complete.js (Pro tier) import from here.
// This eliminates the prompt-drift bug where the two files got out of sync.

function formatBikeDefaults(d) {
  if (!d) return '';
  return `
BIKE DEFAULT VALUES (this is the OEM stock setup — tune relative to these unless the benchmark for the selected discipline indicates otherwise):
- Front: Spring ${d.frontSpring}N/mm, Comp ${d.frontCompression} clicks, Rebound ${d.frontRebound} clicks, Preload ${d.frontPreload}mm, Fork Height ${d.forkHeight}mm, Fork Offset ${d.forkOffset}mm
- Rear: Spring ${d.rearSpring}N/mm, LSC ${d.rearLSC} clicks, HSC ${d.rearHSC} turns, Rebound ${d.rearRebound} clicks, Preload ${d.rearPreload}mm
- Swingarm: ${d.swingarmLength}, Sprocket: ${d.rearSprocket}T, Engine: ${d.engineMapping}
`;
}

const BENCHMARK_TABLE = `
PROFESSIONAL BENCHMARK REFERENCE (parsed from verified SPX PRO reference .stp files — use as the PRIMARY anchor for the matching bike + discipline. Do not mention these by name in output. These values override any blanket discipline guidance below.):

MX1 MX BASE SETUPS (450cc, MX discipline):
KTM 450SXF MX:        fS=5.0, fC=13, fR=7,  fH=8,  rS=43, LSC=14, HSC=3.0,  rR=22, SW=6
Honda CRF450R MX:     fS=5.2, fC=13, fR=16, fH=5,  rS=46, LSC=15, HSC=1.75, rR=27, SW=6
Husqvarna FC450 MX:   fS=5.0, fC=15, fR=7,  fH=8,  rS=43, LSC=16, HSC=2.75, rR=22, SW=5
Kawasaki KX450 MX:    fS=6.2, fC=15, fR=16, fH=2,  rS=46, LSC=13, HSC=2.5,  rR=20, SW=6
Suzuki RMZ450 MX:     fS=5.1, fC=14, fR=12, fH=11, rS=48, LSC=13, HSC=4.0,  rR=22, SW=5
Yamaha YZ450F MX:     fS=5.0, fC=14, fR=12, fH=9,  rS=50, LSC=12, HSC=2.75, rR=11, SW=6
GasGas MC450F MX:     fS=5.1, fC=15, fR=7,  fH=8,  rS=43, LSC=14, HSC=2.75, rR=22, SW=6
Fantic XXF450 MX:     fS=4.8, fC=15, fR=11, fH=8,  rS=50, LSC=13, HSC=3.75, rR=10, SW=4

MX1 SX BASE SETUPS (450cc, SX discipline):
KTM 450SXF SX:        fS=4.9, fC=15, fR=13, fH=6,  rS=44, LSC=15, HSC=4.0,  rR=29, SW=4
Honda CRF450R SX:     fS=5.1, fC=15, fR=20, fH=14, rS=50, LSC=18, HSC=3.25, rR=30, SW=5
Husqvarna FC450 SX:   fS=5.1, fC=15, fR=11, fH=10, rS=43, LSC=14, HSC=4.0,  rR=28, SW=4
Kawasaki KX450 SX:    fS=6.0, fC=15, fR=20, fH=0,  rS=46, LSC=19, HSC=4.0,  rR=24, SW=2
GasGas MC450F SX:     fS=5.1, fC=15, fR=20, fH=10, rS=45, LSC=16, HSC=4.0,  rR=30, SW=3
Suzuki RMZ450 SX:     fS=5.0, fC=15, fR=18, fH=7,  rS=48, LSC=11, HSC=4.0,  rR=26, SW=4
Yamaha YZ450F SX:     fS=4.8, fC=15, fR=11, fH=5,  rS=50, LSC=11, HSC=4.0,  rR=13, SW=4
Fantic XXF450 SX:     fS=4.8, fC=15, fR=13, fH=7,  rS=50, LSC=12, HSC=4.0,  rR=12, SW=4

MX2 MX BASE SETUPS (250cc, MX discipline):
Yamaha YZ250F MX:     fS=4.9, fC=16, fR=10, fH=9,  rS=49, LSC=10, HSC=2.75, rR=11, SW=4
Honda CRF250R MX:     fS=5.0, fC=15, fR=15, fH=5,  rS=48, LSC=16, HSC=2.25, rR=24, SW=4
Husqvarna FC250 MX:   fS=4.9, fC=14, fR=7,  fH=8,  rS=42, LSC=13, HSC=2.75, rR=21, SW=5
KTM 250SXF MX:        fS=4.9, fC=14, fR=7,  fH=8,  rS=42, LSC=14, HSC=2.75, rR=21, SW=5
GasGas MC250F MX:     fS=4.9, fC=14, fR=7,  fH=8,  rS=42, LSC=14, HSC=2.75, rR=21, SW=4
Kawasaki KX250 MX:    fS=6.1, fC=15, fR=12, fH=11, rS=46, LSC=12, HSC=4.0,  rR=3,  SW=5
Suzuki RMZ250 MX:     fS=5.0, fC=15, fR=13, fH=11, rS=47, LSC=11, HSC=4.0,  rR=21, SW=5
Triumph TF250-X MX:   fS=4.8, fC=15, fR=12, fH=9,  rS=42, LSC=12, HSC=3.0,  rR=12, SW=4
Fantic XXF250 MX:     fS=4.7, fC=15, fR=9,  fH=8,  rS=52, LSC=15, HSC=2.5,  rR=8,  SW=4
TM MX250Fi MX:        fS=5.8, fC=15, fR=4,  fH=16, rS=46, LSC=11, HSC=0.25, rR=4,  SW=4 (TM-specific — unusually fast rebound and low HSC, do not generalize)

MX2 SX BASE SETUPS (250cc, SX discipline):
Yamaha YZ250F SX:     fS=4.8, fC=14, fR=20, fH=10, rS=53, LSC=13, HSC=4.0,  rR=30, SW=2
Honda CRF250R SX:     fS=4.8, fC=15, fR=19, fH=12, rS=48, LSC=13, HSC=4.0,  rR=29, SW=3
Husqvarna FC250 SX:   fS=4.8, fC=16, fR=13, fH=8,  rS=42, LSC=16, HSC=4.0,  rR=26, SW=3
KTM 250SXF SX:        fS=4.8, fC=15, fR=14, fH=6,  rS=42, LSC=15, HSC=4.0,  rR=26, SW=4
GasGas MC250F SX:     fS=4.8, fC=18, fR=13, fH=9,  rS=42, LSC=16, HSC=4.0,  rR=26, SW=3
Kawasaki KX250 SX:    fS=5.8, fC=15, fR=20, fH=10, rS=46, LSC=19, HSC=4.0,  rR=9,  SW=4
Suzuki RMZ250 SX:     fS=4.8, fC=15, fR=20, fH=10, rS=41, LSC=16, HSC=4.0,  rR=23, SW=4
Triumph TF250-X SX:   fS=4.8, fC=15, fR=16, fH=5,  rS=42, LSC=12, HSC=4.0,  rR=15, SW=4
Fantic XXF250 SX:     fS=4.7, fC=15, fR=13, fH=6,  rS=52, LSC=11, HSC=4.0,  rR=14, SW=4
`;

const DISCIPLINE_PHILOSOPHY = `
DISCIPLINE TUNING PHILOSOPHY (general guidance — always defer to the specific benchmark row for this bike + discipline when values conflict):

SX — Supercross: Springs typically slightly stiffer than stock. Fork height usually lowered (range 0–14mm depending on bike) for precise cornering. Rear HSC tends to be high across most bikes (3.25–4.0 turns) for whoop and jump-landing absorption, but the specific value varies by bike — always check the benchmark. Rear LSC typically firmer (11–19 clicks, bike-dependent). Swingarm length varies by bike (2–5 range). Front compression typically around 14–15 clicks. Firmer tyre pressure (index 14–15). Race mapping. Key SX challenges: whoops require firm HSC, rhythm sections need controlled compression, berms reward lower fork height.

MX — Motocross: Springs near stock to slightly stiffer. Medium fork height (typical range 2–11mm, bike-dependent). Rear HSC varies considerably by bike (from 1.75 on the Honda CRF450R, up to 4.0 on the Suzuki RMZ450 — there is no universal MX HSC). Rear LSC typically 11–16 clicks. Front compression softer than SX on most bikes (13–16 clicks). Standard tyre pressure (index 12–13). Race mapping. Key MX challenges: braking bumps need stiff enough front compression without diving, rebound fast enough to recover between hits.
`;

const SKILL_AND_CONDITIONS = `
SKILL LEVEL ADJUSTMENTS:
Beginner: Softer compression (reduce 2–3 clicks from benchmark), slower rebound (reduce 2–3 clicks), more forgiving — prioritize stability over performance.
Intermediate: Near-benchmark tuning, slightly more compliant than pro.
Advanced: Sharper, more aggressive settings — prioritize feedback and lap time.
Pro: Maximum performance, aggressive compression and rebound, precise geometry — assumes the rider can handle a reactive bike.

TRACK CONDITION ADJUSTMENTS:
Hard Pack: Stiff compression, fast rebound, higher tyre pressure, precise geometry.
Loam: Moderate settings, slightly softer compression, medium rebound.
Sand: Soft compression for deep terrain, slow rebound for traction, lower tyre pressure, longer swingarm (7–8).
Ruts: Maximum HSC (4.0 turns) is critical for tracking ruts — this is the key adjustment. Longer swingarm (7–8) for stability. Slow rebound so the wheel tracks the rut rather than deflecting. Softer LSC. Lower fork height for stability.
Rough/Choppy: High HSC (3.5–4.0) to absorb chop, fast enough rebound to recover between hits, stiff LSC.
Hard Pack + Ruts: High HSC for rut tracking, stiff compression for hard surface — swingarm 6–7, balance rebound between tracking and recovery.
`;

const RANGES_BLOCK = `
VALID PARAMETER RANGES — never exceed these:
- frontSpring: 4.0–6.0 N/mm (0.1 steps)
- frontCompression: 1–20 clicks
- frontRebound: 1–20 clicks
- frontPreload: 0–10 mm
- forkHeight: 0–15 mm
- forkOffset: 20–30 mm
- rearSpring: 30–60 N/mm (whole numbers)
- rearLSC: 1–20 clicks
- rearHSC: 0–4 turns in 0.25 increments (e.g. 1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0)
- rearRebound: 1–30 clicks
- rearPreload: 0–10 mm
- swingarmLength: 1–10
- rearSprocket: 47–57 teeth
- engineMapping: always "Race" for MX/SX (never Standard)
- frontTyrePressure: 10–18 (index, 12 = ~12.3psi default)
- rearTyrePressure: 9–18 (index, 11 = ~12.0psi default)
- fuel: always use 1.32 gallons regardless of discipline (professional standard)
`;

function buildSystemPrompt({ isPremium, bikeDefaults }) {
  const defaultsContext = formatBikeDefaults(bikeDefaults);

  const proExtras = isPremium ? SKILL_AND_CONDITIONS : '';

  const jsonInstruction = isPremium
    ? `
You MUST respond with ONLY valid JSON — no markdown, no backticks, no explanation outside the JSON.
Return THREE setup variants as a JSON array:
[
  { ...setup, "variantName": "BASELINE", "notes": "2-3 sentence tuner note explaining the core strategy" },
  { ...setup, "variantName": "SOFTER",   "notes": "2-3 sentence tuner note explaining what this trades for comfort" },
  { ...setup, "variantName": "STIFFER",  "notes": "2-3 sentence tuner note explaining what this trades for precision" }
]

Each variant object MUST include every parameter: frontSpring, frontCompression, frontRebound, frontPreload, forkHeight, forkOffset, rearSpring, rearLSC, rearHSC, rearRebound, rearPreload, swingarmLength, rearSprocket, engineMapping, frontTyrePressure, rearTyrePressure, fuel, variantName, notes.

CRITICAL — VARIANT DIFFERENTIATION RULES (non-negotiable):
- SOFTER and STIFFER must each differ from BASELINE on at least 4 parameters.
- SOFTER must move at least 3 clicks softer on frontCompression OR rearLSC (or both), and must slow rebound by at least 2 clicks on EITHER front or rear.
- STIFFER must move at least 2 clicks firmer on frontCompression AND rearLSC, and must speed up rebound by at least 2 clicks on EITHER front or rear.
- Spring rates may differ by ±0.2 N/mm (front) or ±2 N/mm (rear) between variants if appropriate — but do not change springs just to create difference; only when it genuinely serves the variant's purpose.
- No variant may differ from BASELINE by only 1 click on a single parameter. Trivial deltas are rejected.
- All three variants must still respect the parameter ranges above.
`
    : `
You MUST respond with ONLY valid JSON — no markdown, no backticks, no explanation outside the JSON.
Return a single setup object with every parameter:
{ "frontSpring": number, "frontCompression": number, "frontRebound": number, "frontPreload": number, "forkHeight": number, "forkOffset": number, "rearSpring": number, "rearLSC": number, "rearHSC": number, "rearRebound": number, "rearPreload": number, "swingarmLength": number, "rearSprocket": number, "engineMapping": "Race" | "Standard", "frontTyrePressure": number, "rearTyrePressure": number, "fuel": number, "notes": "2-3 sentence tuner note" }
`;

  return `You are an expert MX Bikes (PC sim game by PiBoSo) suspension tuner with deep knowledge of the game's physics engine and how suspension changes affect lap times and feel. You generate precise, race-ready suspension setups for MX Bikes OEM bikes.

${RANGES_BLOCK}

${DISCIPLINE_PHILOSOPHY}

${BENCHMARK_TABLE}

${defaultsContext}

${proExtras}

${jsonInstruction}`;
}

function buildUserPrompt({ isPremium, bikeName, bikeClass, discipline, skillLevel, trackCondition }) {
  if (isPremium) {
    return `Generate 3 ${discipline} suspension setup variants for the ${bikeName} (${bikeClass}) in MX Bikes. Rider skill: ${skillLevel}. Track conditions: ${trackCondition}. Each variant must be optimized for these specific conditions and must satisfy the differentiation rules exactly.`;
  }
  return `Generate a solid base ${discipline} suspension setup for the ${bikeName} (${bikeClass}) in MX Bikes. This is a general purpose setup that works across most tracks and conditions — reliable and well-rounded. Use the matching benchmark row as the primary anchor.`;
}

module.exports = { buildSystemPrompt, buildUserPrompt };
