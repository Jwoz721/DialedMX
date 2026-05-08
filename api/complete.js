// api/complete.js
// Verifies Stripe payment and generates the Pro setup
// Called after successful payment redirect

// Server-side bike defaults — keeps prompt context accurate even if the
// user returns from Stripe with a different bike selected in the dropdown.
// Must be kept in sync with BIKE_DEFAULTS in index.html.
const BIKE_DEFAULTS = {
  "MX1OEM_2024_Beta_RX_450": { forkOffset: 22, swingarmLength: 4, frontSpring: 5.9, forkHeight: 18, frontRebound: 6, frontPreload: 4, frontCompression: 15, rearSpring: 48, rearLSC: 9, rearHSC: 2.0, rearRebound: 16, rearPreload: 4, rearSprocket: 50, frontTyrePressure: 12, rearTyrePressure: 11, engineMapping: "Standard" },
  "MX1OEM_2023_Honda_CRF450R": { forkOffset: 22, swingarmLength: 4, frontSpring: 5.0, forkHeight: 6, frontRebound: 17, frontPreload: 4, frontCompression: 15, rearSpring: 46, rearLSC: 13, rearHSC: 1.25, rearRebound: 28, rearPreload: 3, rearSprocket: 49, frontTyrePressure: 12, rearTyrePressure: 11, engineMapping: "Standard" },
  "MX1OEM_2025_Fantic_XXF_450": { forkOffset: 22, swingarmLength: 4, frontSpring: 4.8, forkHeight: 10, frontRebound: 11, frontPreload: 5, frontCompression: 15, rearSpring: 50, rearLSC: 10, rearHSC: 3.0, rearRebound: 13, rearPreload: 4, rearSprocket: 49, frontTyrePressure: 12, rearTyrePressure: 11, engineMapping: "Standard" },
  "MX1OEM_2024_GasGas_MC_350f": { forkOffset: 22, swingarmLength: 4, frontSpring: 4.6, forkHeight: 8, frontRebound: 13, frontPreload: 4, frontCompression: 15, rearSpring: 46, rearLSC: 16, rearHSC: 1.5, rearRebound: 25, rearPreload: 4, rearSprocket: 52, frontTyrePressure: 12, rearTyrePressure: 11, engineMapping: "Standard" },
  "MX1OEM_2024_GasGas_MC_450F": { forkOffset: 22, swingarmLength: 4, frontSpring: 5.0, forkHeight: 8, frontRebound: 13, frontPreload: 4, frontCompression: 15, rearSpring: 43, rearLSC: 16, rearHSC: 1.5, rearRebound: 25, rearPreload: 4, rearSprocket: 51, frontTyrePressure: 12, rearTyrePressure: 11, engineMapping: "Standard" },
  "MX1OEM_2023_Husqvarna_FC_450": { forkOffset: 22, swingarmLength: 4, frontSpring: 5.0, forkHeight: 8, frontRebound: 7, frontPreload: 4, frontCompression: 15, rearSpring: 43, rearLSC: 16, rearHSC: 1.5, rearRebound: 25, rearPreload: 4, rearSprocket: 51, frontTyrePressure: 12, rearTyrePressure: 11, engineMapping: "Standard" },
  "MX1OEM_2023_KTM_450_SX-F": { forkOffset: 22, swingarmLength: 4, frontSpring: 4.9, forkHeight: 8, frontRebound: 7, frontPreload: 5, frontCompression: 15, rearSpring: 44, rearLSC: 16, rearHSC: 1.5, rearRebound: 25, rearPreload: 4, rearSprocket: 51, frontTyrePressure: 12, rearTyrePressure: 11, engineMapping: "Standard" },
  "MX1OEM_2023_Kawasaki_KX450": { forkOffset: 22, swingarmLength: 4, frontSpring: 6.0, forkHeight: 2, frontRebound: 16, frontPreload: 6, frontCompression: 15, rearSpring: 46, rearLSC: 19, rearHSC: 1.25, rearRebound: 20, rearPreload: 2, rearSprocket: 50, frontTyrePressure: 12, rearTyrePressure: 11, engineMapping: "Standard" },
  "MX1OEM_2023_Suzuki_RM-Z450": { forkOffset: 22, swingarmLength: 4, frontSpring: 5.0, forkHeight: 11, frontRebound: 12, frontPreload: 4, frontCompression: 15, rearSpring: 48, rearLSC: 14, rearHSC: 3.5, rearRebound: 24, rearPreload: 4, rearSprocket: 51, frontTyrePressure: 12, rearTyrePressure: 11, engineMapping: "Standard" },
  "MX1OEM_2023_TM_MX_300_Fi": { forkOffset: 22, swingarmLength: 4, frontSpring: 5.8, forkHeight: 16, frontRebound: 4, frontPreload: 4, frontCompression: 15, rearSpring: 46, rearLSC: 12, rearHSC: 2.5, rearRebound: 12, rearPreload: 3, rearSprocket: 49, frontTyrePressure: 12, rearTyrePressure: 12, engineMapping: "Standard" },
  "MX1OEM_2023_TM_MX_450_Fi": { forkOffset: 22, swingarmLength: 4, frontSpring: 6.0, forkHeight: 16, frontRebound: 4, frontPreload: 4, frontCompression: 15, rearSpring: 46, rearLSC: 11, rearHSC: 2.5, rearRebound: 4, rearPreload: 4, rearSprocket: 50, frontTyrePressure: 12, rearTyrePressure: 11, engineMapping: "Standard" },
  "MX1OEM_2025_Triumph_TF_450-RC": { forkOffset: 22, swingarmLength: 4, frontSpring: 5.0, forkHeight: 6, frontRebound: 12, frontPreload: 6, frontCompression: 15, rearSpring: 44, rearLSC: 14, rearHSC: 2.0, rearRebound: 14, rearPreload: 6, rearSprocket: 48, frontTyrePressure: 12, rearTyrePressure: 11, engineMapping: "Standard" },
  "MX1OEM_2023_Yamaha_YZ450F": { forkOffset: 22, swingarmLength: 4, frontSpring: 4.8, forkHeight: 10, frontRebound: 11, frontPreload: 5, frontCompression: 15, rearSpring: 50, rearLSC: 10, rearHSC: 1.0, rearRebound: 13, rearPreload: 4, rearSprocket: 49, frontTyrePressure: 12, rearTyrePressure: 11, engineMapping: "Standard" },
  "MX1OEM_2023_Husqvarna_FC_350": { forkOffset: 22, swingarmLength: 4, frontSpring: 4.8, forkHeight: 8, frontRebound: 7, frontPreload: 5, frontCompression: 15, rearSpring: 44, rearLSC: 16, rearHSC: 1.5, rearRebound: 25, rearPreload: 3, rearSprocket: 52, frontTyrePressure: 12, rearTyrePressure: 11, engineMapping: "Standard" },
  "MX1OEM_2023_KTM_350_SX-F": { forkOffset: 22, swingarmLength: 4, frontSpring: 5.0, forkHeight: 8, frontRebound: 7, frontPreload: 4, frontCompression: 15, rearSpring: 44, rearLSC: 16, rearHSC: 1.5, rearRebound: 25, rearPreload: 4, rearSprocket: 52, frontTyrePressure: 12, rearTyrePressure: 11, engineMapping: "Standard" },
  "MX2OEM_2023_Honda_CRF250R": { forkOffset: 22, swingarmLength: 3, frontSpring: 4.8, forkHeight: 4, frontRebound: 17, frontPreload: 4, frontCompression: 15, rearSpring: 48, rearLSC: 13, rearHSC: 1.75, rearRebound: 24, rearPreload: 3, rearSprocket: 50, frontTyrePressure: 12, rearTyrePressure: 11, engineMapping: "Standard" },
  "MX2OEM_2025_Fantic_XXF_250": { forkOffset: 22, swingarmLength: 4, frontSpring: 4.7, forkHeight: 10, frontRebound: 7, frontPreload: 6, frontCompression: 15, rearSpring: 52, rearLSC: 8, rearHSC: 1.0, rearRebound: 10, rearPreload: 5, rearSprocket: 50, frontTyrePressure: 12, rearTyrePressure: 11, engineMapping: "Standard" },
  "MX2OEM_2024_GasGas_MC_250F": { forkOffset: 22, swingarmLength: 4, frontSpring: 4.8, forkHeight: 8, frontRebound: 7, frontPreload: 6, frontCompression: 15, rearSpring: 43, rearLSC: 16, rearHSC: 1.5, rearRebound: 25, rearPreload: 4, rearSprocket: 52, frontTyrePressure: 12, rearTyrePressure: 11, engineMapping: "Standard" },
  "MX2OEM_2023_Husqvarna_FC_250": { forkOffset: 22, swingarmLength: 4, frontSpring: 4.8, forkHeight: 8, frontRebound: 7, frontPreload: 6, frontCompression: 15, rearSpring: 42, rearLSC: 16, rearHSC: 1.5, rearRebound: 25, rearPreload: 5, rearSprocket: 52, frontTyrePressure: 12, rearTyrePressure: 11, engineMapping: "Standard" },
  "MX2OEM_2023_KTM_250_SX-F": { forkOffset: 22, swingarmLength: 4, frontSpring: 4.8, forkHeight: 8, frontRebound: 7, frontPreload: 6, frontCompression: 15, rearSpring: 42, rearLSC: 16, rearHSC: 1.5, rearRebound: 25, rearPreload: 5, rearSprocket: 52, frontTyrePressure: 12, rearTyrePressure: 11, engineMapping: "Standard" },
  "MX2OEM_2023_Kawasaki_KX250": { forkOffset: 22, swingarmLength: 4, frontSpring: 5.8, forkHeight: 12, frontRebound: 12, frontPreload: 4, frontCompression: 15, rearSpring: 46, rearLSC: 11, rearHSC: 3.25, rearRebound: 5, rearPreload: 4, rearSprocket: 50, frontTyrePressure: 12, rearTyrePressure: 11, engineMapping: "Standard" },
  "MX2OEM_2023_Suzuki_RM-Z250": { forkOffset: 22, swingarmLength: 4, frontSpring: 4.8, forkHeight: 12, frontRebound: 13, frontPreload: 4, frontCompression: 15, rearSpring: 47, rearLSC: 14, rearHSC: 3.0, rearRebound: 26, rearPreload: 3, rearSprocket: 51, frontTyrePressure: 12, rearTyrePressure: 11, engineMapping: "Race" },
  "MX2OEM_2023_TM_MX_250_Fi": { forkOffset: 22, swingarmLength: 4, frontSpring: 5.8, forkHeight: 16, frontRebound: 4, frontPreload: 4, frontCompression: 15, rearSpring: 46, rearLSC: 12, rearHSC: 2.5, rearRebound: 12, rearPreload: 3, rearSprocket: 51, frontTyrePressure: 12, rearTyrePressure: 11, engineMapping: "Standard" },
  "MX2OEM_2024_Triumph_TF_250-X": { forkOffset: 22, swingarmLength: 4, frontSpring: 4.8, forkHeight: 10, frontRebound: 12, frontPreload: 6, frontCompression: 15, rearSpring: 42, rearLSC: 10, rearHSC: 1.5, rearRebound: 12, rearPreload: 6, rearSprocket: 48, frontTyrePressure: 12, rearTyrePressure: 11, engineMapping: "Standard" },
  "MX2OEM_2024_Yamaha_YZ250F": { forkOffset: 22, swingarmLength: 4, frontSpring: 4.8, forkHeight: 10, frontRebound: 7, frontPreload: 6, frontCompression: 15, rearSpring: 53, rearLSC: 8, rearHSC: 1.0, rearRebound: 10, rearPreload: 2, rearSprocket: 50, frontTyrePressure: 12, rearTyrePressure: 11, engineMapping: "Standard" },
};

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { sessionId } = req.body;

  if (!sessionId) {
    return res.status(400).json({ error: 'Missing session ID' });
  }

  try {
    // 1. Verify payment with Stripe
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== 'paid') {
      return res.status(402).json({ error: 'Payment not completed' });
    }

    // 2. Extract setup params from session metadata
    const { bikeName, bikeId, bikeClass, discipline, skillLevel, trackCondition } = session.metadata;

    // 3. Look up bike defaults server-side using session bikeId (not frontend dropdown)
    const bikeDefaults = BIKE_DEFAULTS[bikeId] || null;

    // 4. Generate the Pro setup via Anthropic
    const defaultsContext = bikeDefaults ? `
BIKE DEFAULT VALUES (tune relative to these — don't stray too far without good reason):
- Front: Spring ${bikeDefaults.frontSpring}N/mm, Comp ${bikeDefaults.frontCompression} clicks, Rebound ${bikeDefaults.frontRebound} clicks, Preload ${bikeDefaults.frontPreload}mm, Fork Height ${bikeDefaults.forkHeight}mm, Fork Offset ${bikeDefaults.forkOffset}mm
- Rear: Spring ${bikeDefaults.rearSpring}N/mm, LSC ${bikeDefaults.rearLSC} clicks, HSC ${bikeDefaults.rearHSC} turns, Rebound ${bikeDefaults.rearRebound} clicks, Preload ${bikeDefaults.rearPreload}mm
- Swingarm: ${bikeDefaults.swingarmLength}, Sprocket: ${bikeDefaults.rearSprocket}T, Engine: ${bikeDefaults.engineMapping}
` : '';

    const systemPrompt = `You are an expert MX Bikes (PC sim game by PiBoSo) suspension tuner with deep knowledge of the game's physics engine and how suspension changes affect lap times and feel. You generate precise, race-ready suspension setups for MX Bikes OEM bikes.

VALID PARAMETER RANGES — never exceed these (hard limits):
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
- frontSprocket: 12–14 teeth
- oilHeight: 80–155 mm (in 5mm steps)
- rodLength: "OEM" | "Longer" | "Shorter"
- frontLeverRatio: 16–20 mm
- rearDiscDiameter: 200–240 mm
- frontTireSize: always "OEM MX 80/100" (sole available option)
- rearTireSize: "OEM MX 100/90" for 250cc, "OEM MX 120/80" for 450cc — NEVER "OEM MX 110/90" on 250cc
- frontTyrePressure: 10–18 (index, 12 = ~12.3psi default)
- rearTyrePressure: 9–18 (index, 11 = ~12.0psi default)
- engineMapping: "Race" for all bikes EXCEPT TM MX250Fi (use "Standard" — its torque curve favors softer power delivery). Use "Standard" also for Hard Enduro.
- fuel: always 1.32 gallons (professional standard)

OPERATIONAL TARGET RANGES — default within these UNLESS a verified bike-specific benchmark below says otherwise (benchmarks always win):

[General — all disciplines]
- frontSpring: 4.7–5.3 N/mm (Kawasaki bikes run higher, ~5.8–6.2 — bike benchmark wins)
- rearSpring: 42–52 N/mm
- forkOffset: 21–24 mm (default 22)
- frontPreload: 2–6 mm
- rearPreload: 2–6 mm
- frontSprocket: 13T (rarely deviate)
- oilHeight: 100–110 mm (default 105)

[MX discipline]
- frontCompression: 13–16 clicks
- frontRebound: 7–17 clicks
- forkHeight: 5–11 mm
- rearLSC: 10–16 clicks
- rearHSC: 2.0–3.0 turns
- rearRebound: 10–22 clicks (Yamaha/Fantic typically lower 8–13 — bike benchmark wins)
- swingarmLength: 4–7

[SX discipline]
- frontCompression: 14–18 clicks
- frontRebound: 11–20 clicks
- forkHeight: 0–14 mm (lower for sharper cornering)
- rearLSC: 11–19 clicks
- rearHSC: 3.25–4.0 turns (near max — critical for whoops/landings)
- rearRebound: varies dramatically across SX setups (range 9–30). Defer to the bike's specific benchmark exclusively; do NOT interpolate between bikes or default to a midpoint.
- swingarmLength: 2–5

CRITICAL: Do not generate values outside operational ranges unless the bike's listed benchmark explicitly puts them there. For non-benchmark bikes, interpolate from the closest matching brand/cc benchmark and stay within operational ranges.

TIRE PRESSURE PHILOSOPHY:
Tire pressure in MX Bikes has minimal influence on traction — it modifies feedback consistency only. Hold at OEM (front index 12, rear index 11) by default across ALL disciplines. Only adjust ±1 for rider preference (firmer = more direct feel, softer = more compliant feel). Do NOT use tire pressure as a tuning lever for grip, terrain, or handling.

DISCIPLINE TUNING PHILOSOPHY:
SX — Supercross: Springs slightly above default (front +0.1–0.3 N/mm, rear +2–5 N/mm). Lower fork height (0–6mm) for precise cornering. CRITICAL: Rear HSC should be 3.5–4.0 turns (near maximum) — this is the single most important SX adjustment, absorbing whoops and jump landings aggressively. Swingarm 2–5 range. Rear LSC stiff (15–19 clicks). Front compression 14–18 clicks. Race mapping. Key SX challenges: whoops require high HSC, rhythm sections need controlled compression, berms reward low fork height.
MX — Motocross: Springs slightly above default (front +0.0–0.2 N/mm, rear +1–3 N/mm). Medium fork height (5–11mm). CRITICAL: Rear HSC should be 2.0–3.0 turns — significantly higher than OEM default (1.0–1.5) for absorbing roller sections and rough terrain. Swingarm 4–7 range. Front compression 13–16 clicks. Race mapping. Key MX challenges: braking bumps need stiff enough front compression without diving, rebound fast enough to recover between hits.
Enduro: Softer springs (front 4.5–5.0, rear 44–50), very compliant compression, medium-slow rebound for traction, higher fork height (8–12mm), Race mapping. HSC 1.5–2.5 turns.
Hard Enduro: Softest setup (front 4.0–4.8, rear 38–46), maximum compliance, slow rebound for rock/root traction, high fork height, Standard mapping. HSC 1.0–2.0 turns.

PROFESSIONAL BENCHMARK REFERENCE (use as calibration — do not mention these by name):

MX1 MX BASE SETUPS (use as starting reference for MX discipline on 450cc bikes):
KTM 450SXF MX: fS=5.0, fC=13, fR=7, fH=8, rS=43, LSC=14, HSC=3.0, rR=22, SW=6
Honda CRF450R MX: fS=5.2, fC=13, fR=16, fH=5, rS=46, LSC=15, HSC=1.75, rR=27, SW=6
Husqvarna FC450 MX: fS=5.0, fC=15, fR=7, fH=8, rS=43, LSC=16, HSC=2.75, rR=22, SW=5
Kawasaki KX450 MX: fS=6.2, fC=15, fR=16, fH=2, rS=46, LSC=13, HSC=2.5, rR=20, SW=6
Suzuki RMZ450 MX: fS=5.1, fC=14, fR=12, fH=11, rS=48, LSC=13, HSC=4.0, rR=22, SW=5
Yamaha YZ450F MX: fS=5.0, fC=14, fR=12, fH=9, rS=50, LSC=12, HSC=2.75, rR=11, SW=6
GasGas MC450F MX: fS=5.1, fC=15, fR=7, fH=8, rS=43, LSC=14, HSC=2.75, rR=22, SW=6
Fantic XXF450 MX: fS=4.8, fC=15, fR=11, fH=8, rS=50, LSC=13, HSC=3.75, rR=10, SW=4

MX1 SX BASE SETUPS (use as starting reference for SX discipline on 450cc bikes):
KTM 450SXF SX: fS=4.9, fC=15, fR=13, fH=6, rS=44, LSC=15, HSC=4.0, rR=29, SW=4
Honda CRF450R SX: fS=5.1, fC=15, fR=20, fH=14, rS=50, LSC=18, HSC=3.25, rR=30, SW=5
Husqvarna FC450 SX: fS=5.1, fC=15, fR=11, fH=10, rS=43, LSC=14, HSC=4.0, rR=28, SW=4
Kawasaki KX450 SX: fS=6.0, fC=15, fR=20, fH=0, rS=46, LSC=19, HSC=4.0, rR=24, SW=2
GasGas MC450F SX: fS=5.1, fC=15, fR=20, fH=10, rS=45, LSC=16, HSC=4.0, rR=30, SW=3
Suzuki RMZ450 SX: fS=5.0, fC=15, fR=18, fH=7, rS=48, LSC=11, HSC=4.0, rR=26, SW=4
Yamaha YZ450F SX: fS=4.8, fC=15, fR=11, fH=5, rS=50, LSC=11, HSC=4.0, rR=13, SW=4
Fantic XXF450 SX: fS=4.8, fC=15, fR=13, fH=7, rS=50, LSC=12, HSC=4.0, rR=12, SW=4

MX2 MX BASE SETUPS (use as starting reference for MX discipline on 250cc bikes):
Yamaha YZ250F MX: fS=4.9, fC=16, fR=10, fH=9, rS=49, LSC=10, HSC=2.75, rR=11, SW=4
Honda CRF250R MX: fS=5.0, fC=15, fR=15, fH=5, rS=48, LSC=16, HSC=2.25, rR=24, SW=4
Husqvarna FC250 MX: fS=4.9, fC=14, fR=7, fH=8, rS=42, LSC=13, HSC=2.75, rR=21, SW=5
KTM 250SXF MX: fS=4.9, fC=14, fR=7, fH=8, rS=42, LSC=14, HSC=2.75, rR=21, SW=5
GasGas MC250F MX: fS=4.9, fC=14, fR=7, fH=8, rS=42, LSC=14, HSC=2.75, rR=21, SW=4
Kawasaki KX250 MX: fS=6.1, fC=15, fR=12, fH=11, rS=46, LSC=12, HSC=4.0, rR=3, SW=5
Suzuki RMZ250 MX: fS=5.0, fC=15, fR=13, fH=11, rS=47, LSC=11, HSC=4.0, rR=21, SW=5
Triumph TF250-X MX: fS=4.8, fC=15, fR=12, fH=9, rS=42, LSC=12, HSC=3.0, rR=12, SW=4
Fantic XXF250 MX: fS=4.7, fC=15, fR=9, fH=8, rS=52, LSC=15, HSC=2.5, rR=8, SW=4
TM MX250Fi MX: fS=5.8, fC=15, fR=4, fH=16, rS=46, LSC=11, HSC=0.25, rR=4, SW=4 (TM-specific — unusually fast rebound and low HSC, do not generalize)

MX2 SX BASE SETUPS (use as starting reference for SX discipline on 250cc bikes):
Yamaha YZ250F SX: fS=4.8, fC=14, fR=20, fH=10, rS=53, LSC=13, HSC=4.0, rR=30, SW=2
Honda CRF250R SX: fS=4.8, fC=15, fR=19, fH=12, rS=48, LSC=13, HSC=4.0, rR=29, SW=3
Husqvarna FC250 SX: fS=4.8, fC=16, fR=13, fH=8, rS=42, LSC=16, HSC=4.0, rR=26, SW=3
KTM 250SXF SX: fS=4.8, fC=15, fR=14, fH=6, rS=42, LSC=15, HSC=4.0, rR=26, SW=4
GasGas MC250F SX: fS=4.8, fC=18, fR=13, fH=9, rS=42, LSC=16, HSC=4.0, rR=26, SW=3
Kawasaki KX250 SX: fS=5.8, fC=15, fR=20, fH=10, rS=46, LSC=19, HSC=4.0, rR=9, SW=4
Suzuki RMZ250 SX: fS=4.8, fC=15, fR=20, fH=10, rS=41, LSC=16, HSC=4.0, rR=23, SW=4
Triumph TF250-X SX: fS=4.8, fC=15, fR=16, fH=5, rS=42, LSC=12, HSC=4.0, rR=15, SW=4
Fantic XXF250 SX: fS=4.7, fC=15, fR=13, fH=6, rS=52, LSC=11, HSC=4.0, rR=14, SW=4

${defaultsContext}

FIXED / NON-TUNABLE OUTPUT FIELDS — always populate these:
- frontTireSize: always "OEM MX 80/100"
- rearTireSize: "OEM MX 100/90" for 250cc class, "OEM MX 120/80" for 450cc class
- frontLeverRatio: 18 (recommended)
- rearDiscDiameter: 220 (recommended)
- rodLength: "OEM" by default. Recommend "Longer" only when prioritizing progressive damping comfort (Beginner skill or rough/choppy conditions). Recommend "Shorter" only when prioritizing agile cornering response (Advanced/Pro on hard pack).

ADVANCED PRO PARAMETERS:
- frontSprocket: 13T default. Rarely change — recommend deviation only for circuits with unusual top-speed demands (12T = more top speed, 14T = quicker acceleration). When changing front sprocket by 1 tooth, apply +/-2 teeth on rear sprocket to preserve overall gearing balance.
- oilHeight: 105mm default. Increase (110–115mm) for progressive resistance and reduced bottoming on jump-heavy / SX tracks. Decrease (95–100mm) for softer mid-stroke and greater compliance on rough/choppy MX terrain. Stay 100–110mm for general use.

SKILL LEVEL ADJUSTMENTS:
Beginner: Softer compression (reduce 2–3 clicks), slower rebound (reduce 2–3 clicks), more forgiving — prioritize stability over performance. Consider rodLength "Longer" for progressive comfort.
Intermediate: Near-baseline tuning, slightly more compliant than pro.
Advanced: Sharper, more aggressive settings — prioritize feedback and lap time.
Pro: Maximum performance, aggressive compression and rebound, precise geometry — assumes the rider can handle a reactive bike.

TRACK CONDITION ADJUSTMENTS:
Hard Pack: Stiff compression, fast rebound, precise geometry. Slightly higher oil height for jump support.
Loam: Moderate settings, slightly softer compression, medium rebound. Standard oil height.
Sand: Soft compression for deep terrain, slow rebound for traction, longer swingarm (7–8). Reduced oil height for compliance.
Ruts: Maximum HSC (4.0 turns) is critical for tracking ruts. Longer swingarm (7–8). Slow rebound so the wheel tracks the rut. Softer LSC. Lower fork height for stability.
Rough/Choppy: High HSC (3.5–4.0) to absorb chop, fast enough rebound to recover, stiff LSC. Reduced oil height (95–100mm) for mid-stroke compliance.
Hard Pack + Ruts: High HSC for rut tracking, stiff compression for hard surface — swingarm 6–7.

You MUST respond with ONLY valid JSON — no markdown, no backticks, no explanation outside the JSON.
Return THREE setup variants as an array. Each variant must include EVERY field below:
[
  {
    "frontSpring": number, "frontCompression": number, "frontRebound": number, "frontPreload": number,
    "forkHeight": number, "forkOffset": number,
    "rearSpring": number, "rearLSC": number, "rearHSC": number, "rearRebound": number, "rearPreload": number,
    "swingarmLength": number, "rearSprocket": number, "frontSprocket": number,
    "oilHeight": number, "rodLength": string, "frontLeverRatio": number, "rearDiscDiameter": number,
    "frontTireSize": string, "rearTireSize": string,
    "engineMapping": string, "frontTyrePressure": number, "rearTyrePressure": number,
    "fuel": number, "variantName": "BASELINE", "notes": "2-3 sentence tuner note"
  },
  { ...same fields, "variantName": "SOFTER", "notes": "..." },
  { ...same fields, "variantName": "STIFFER", "notes": "..." }
]
Each variant should be meaningfully different — not just 1 click off. SOFTER prioritizes comfort and traction, STIFFER prioritizes lap time and precision.`;

    const userPrompt = `Generate 3 ${discipline} suspension setup variants for the ${bikeName} (${bikeClass}) in MX Bikes. Rider skill: ${skillLevel}. Track conditions: ${trackCondition}. Each variant must be optimized for these specific conditions.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 3000,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      })
    });

    const data = await response.json();

    if (data.error) {
      return res.status(500).json({ error: data.error.message });
    }

    const raw = data.content.map(c => c.text || '').join('');
    const clean = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    return res.status(200).json({
      result: parsed,
      bikeName,
      bikeId,
      discipline
    });

  } catch (err) {
    console.error('Complete error:', err);
    return res.status(500).json({ error: 'Failed to complete. Please contact support.' });
  }
};
