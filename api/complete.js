// api/complete.js
// Verifies Stripe payment and generates the Pro setup
// Called after successful payment redirect

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { sessionId, bikeDefaults } = req.body;

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

    // 3. Generate the Pro setup via Anthropic
    const defaultsContext = bikeDefaults ? `
BIKE DEFAULT VALUES (tune relative to these — don't stray too far without good reason):
- Front: Spring ${bikeDefaults.frontSpring}N/mm, Comp ${bikeDefaults.frontCompression} clicks, Rebound ${bikeDefaults.frontRebound} clicks, Preload ${bikeDefaults.frontPreload}mm, Fork Height ${bikeDefaults.forkHeight}mm, Fork Offset ${bikeDefaults.forkOffset}mm
- Rear: Spring ${bikeDefaults.rearSpring}N/mm, LSC ${bikeDefaults.rearLSC} clicks, HSC ${bikeDefaults.rearHSC} turns, Rebound ${bikeDefaults.rearRebound} clicks, Preload ${bikeDefaults.rearPreload}mm
- Swingarm: ${bikeDefaults.swingarmLength}, Sprocket: ${bikeDefaults.rearSprocket}T, Engine: ${bikeDefaults.engineMapping}
` : '';

    const systemPrompt = `You are an expert MX Bikes (PC sim game by PiBoSo) suspension tuner with deep knowledge of the game's physics engine and how suspension changes affect lap times and feel. You generate precise, race-ready suspension setups for MX Bikes OEM bikes.

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
- engineMapping: "Race" or "Standard"
- frontTyrePressure: 10–18 (index, 12 = ~12.3psi default)
- rearTyrePressure: 9–18 (index, 11 = ~12.0psi default)
- fuel: always use 1.32 gallons regardless of discipline (professional standard)

DISCIPLINE TUNING PHILOSOPHY:
SX — Supercross: Springs slightly above default (front +0.1–0.3 N/mm, rear +2–5 N/mm). Lower fork height (2–6mm) for precise cornering. CRITICAL: Rear HSC should be 3.5–4.0 turns (near maximum) — this is the single most important SX adjustment, absorbing whoops and jump landings aggressively. Swingarm always longer than default (5–8 range, never leave at default 4). Rear LSC stiff (15–19 clicks). Firmer tyre pressure (index 14–15 for both) on most bikes. Lighter fuel (0.8–1.2 gal). Race mapping.
MX — Motocross: Springs slightly above default (front +0.0–0.2 N/mm, rear +1–3 N/mm). Medium fork height (3–8mm). CRITICAL: Rear HSC should be 2.5–3.0 turns — significantly higher than default (1.0–1.5) for absorbing roller sections and rough terrain. Swingarm always longer than default (5–7 range). Front compression softer than SX (7–14 clicks depending on bike). Standard tyre pressure (index 12–13). Medium fuel (1.1–1.4 gal). Race mapping.
Enduro: Softer springs (front 4.5–5.0, rear 44–50), very compliant compression, medium-slow rebound for traction, higher fork height (8–12mm), lower tyre pressure for grip, Race or Standard mapping, fuller fuel (1.2–1.5 gal). HSC 1.5–2.5 turns.
Hard Enduro: Softest setup (front 4.0–4.8, rear 38–46), maximum compliance, slow rebound for rock/root traction, high fork height, lowest tyre pressure, Standard mapping, full fuel (1.5–1.64 gal). HSC 1.0–2.0 turns.

PROFESSIONAL BENCHMARK REFERENCE (use as calibration — do not mention these by name):

MX BASE SETUPS (use as starting reference for MX discipline, adjust based on skill/conditions):
KTM 450SXF MX: fS=5.0, fC=13, fR=7, fH=8, rS=43, LSC=14, HSC=3.0, rR=22, SW=6
Honda CRF450R MX: fS=5.2, fC=13, fR=16, fH=5, rS=46, LSC=15, HSC=1.75, rR=27, SW=6
Husqvarna FC450 MX: fS=5.0, fC=15, fR=7, fH=8, rS=43, LSC=16, HSC=2.75, rR=22, SW=5
Kawasaki KX450 MX: fS=6.2, fC=15, fR=16, fH=2, rS=46, LSC=13, HSC=2.5, rR=20, SW=6
Suzuki RMZ450 MX: fS=5.1, fC=14, fR=12, fH=11, rS=48, LSC=13, HSC=4.0, rR=22, SW=5
Yamaha YZ450F MX: fS=5.0, fC=14, fR=12, fH=9, rS=50, LSC=12, HSC=2.75, rR=11, SW=6
GasGas MC450F MX: fS=5.1, fC=15, fR=7, fH=8, rS=43, LSC=14, HSC=2.75, rR=22, SW=6
Fantic XXF450 MX: fS=4.8, fC=15, fR=11, fH=8, rS=50, LSC=13, HSC=3.75, rR=10, SW=4

SX BASE SETUPS (use as starting reference for SX discipline, adjust based on skill/conditions):
KTM 450SXF SX: fS=4.9, fC=15, fR=13, fH=6, rS=44, LSC=15, HSC=4.0, rR=29, SW=4
Honda CRF450R SX: fS=5.1, fC=15, fR=20, fH=14, rS=50, LSC=18, HSC=3.25, rR=30, SW=5
Husqvarna FC450 SX: fS=5.1, fC=15, fR=11, fH=10, rS=43, LSC=14, HSC=4.0, rR=28, SW=4
Kawasaki KX450 SX: fS=6.0, fC=15, fR=20, fH=0, rS=46, LSC=19, HSC=4.0, rR=24, SW=2
GasGas MC450F SX: fS=5.1, fC=15, fR=20, fH=10, rS=45, LSC=16, HSC=4.0, rR=30, SW=3
Suzuki RMZ450 SX: fS=5.0, fC=15, fR=18, fH=7, rS=48, LSC=11, HSC=4.0, rR=26, SW=4
Yamaha YZ450F SX: fS=4.8, fC=15, fR=11, fH=5, rS=50, LSC=11, HSC=4.0, rR=13, SW=4
Fantic XXF450 SX: fS=4.8, fC=15, fR=13, fH=7, rS=50, LSC=12, HSC=4.0, rR=12, SW=4

${defaultsContext}

SKILL LEVEL ADJUSTMENTS:
Beginner: Softer compression (reduce 2–3 clicks), slower rebound (reduce 2–3 clicks), more forgiving — prioritize stability over performance.
Intermediate: Near-baseline tuning, slightly more compliant than pro.
Advanced: Sharper, more aggressive settings — prioritize feedback and lap time.
Pro: Maximum performance, aggressive compression and rebound, precise geometry — assumes the rider can handle a reactive bike.

TRACK CONDITION ADJUSTMENTS:
Hard Pack: Stiff compression, fast rebound, higher tyre pressure, precise geometry.
Loam: Moderate settings, slightly softer compression, medium rebound.
Sand: Soft compression for deep terrain, slow rebound for traction, lower tyre pressure, longer swingarm (7–8).
Ruts: Maximum HSC (4.0 turns) is critical for tracking ruts. Longer swingarm (7–8). Slow rebound so the wheel tracks the rut. Softer LSC. Lower fork height for stability.
Rough/Choppy: High HSC (3.5–4.0) to absorb chop, fast enough rebound to recover, stiff LSC.
Hard Pack + Ruts: High HSC for rut tracking, stiff compression for hard surface — swingarm 6–7.

You MUST respond with ONLY valid JSON — no markdown, no backticks, no explanation outside the JSON.
Return THREE setup variants as an array:
[
  { ...setup, "fuel": number, "variantName": "BASELINE", "notes": "2-3 sentence tuner note" },
  { ...setup, "fuel": number, "variantName": "SOFTER", "notes": "2-3 sentence tuner note" },
  { ...setup, "fuel": number, "variantName": "STIFFER", "notes": "2-3 sentence tuner note" }
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
        max_tokens: 2500,
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
