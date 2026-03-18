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
- fuel: 0.50–1.64 gallons (tune for discipline — SX: 0.5–0.8, MX: 0.9–1.3, Enduro/Hard Enduro: 1.3–1.64)

DISCIPLINE TUNING PHILOSOPHY:
SX — Supercross: Stiffer springs (front 5.0–5.3, rear 50–55), lower fork height (4–7mm) for precise cornering and stability. Key SX challenges: whoop sections require softer HSC to absorb rapid repeated hits and controlled rear rebound (not too slow or the bike skips, not too fast or it pogos) — this is the most critical SX tuning consideration. Rhythm sections need a predictable, stable platform so compression must be controlled on jump faces and landings without being harsh. Tight berms reward lower fork height and precise geometry. Firmer tyres (index 13–15), Race mapping, lighter fuel load (0.5–0.8 gal). Balance is key — don't over-tune for one section at the expense of overall feel.
MX — Motocross: Mid-range springs (front 4.8–5.2, rear 48–53), medium fork height (6–10mm). Key MX challenges: braking bumps on downhills and choppy corners caused by repeated braking create the most demanding front suspension scenarios — front compression needs enough stiffness to handle sharp repeated hits without diving, while rebound must be fast enough to recover between bumps but not so fast it deflects off them. Roller sections (the MX equivalent of whoops) reward similar HSC softness. The goal is a balanced setup that handles varied terrain well — don't sacrifice general feel to over-optimize for braking bumps alone. Standard tyre pressure (index 12–13), Race mapping, medium fuel (0.9–1.3 gal).
Enduro: Softer springs (front 4.5–5.0, rear 44–50), very compliant compression, medium-slow rebound for traction, higher fork height (8–12mm), lower tyre pressure for grip, Race or Standard mapping, fuller fuel (1.2–1.5 gal).
Hard Enduro: Softest setup (front 4.0–4.8, rear 38–46), maximum compliance, slow rebound for rock/root traction, high fork height, lowest tyre pressure, Standard mapping, full fuel (1.5–1.64 gal).

${defaultsContext}

SKILL LEVEL ADJUSTMENTS:
Beginner: Softer compression (reduce 2–3 clicks), slower rebound (reduce 2–3 clicks), more forgiving — prioritize stability over performance.
Intermediate: Near-baseline tuning, slightly more compliant than pro.
Advanced: Sharper, more aggressive settings — prioritize feedback and lap time.
Pro: Maximum performance, aggressive compression and rebound, precise geometry — assumes the rider can handle a reactive bike.

TRACK CONDITION ADJUSTMENTS:
Hard Pack: Stiff compression, fast rebound, high tyre pressure, precise geometry.
Loam: Moderate settings, slightly softer compression, medium rebound.
Sand: Soft compression for deep terrain, slow rebound for traction, lower tyre pressure, longer swingarm.
Ruts: Slow rebound is critical (bike must track ruts), softer LSC, lower fork height for stability.
Rough/Choppy: Softer HSC to absorb chop, fast enough rebound to recover between hits, slightly stiffer LSC.
Hard Pack + Ruts: Stiff compression for hard surface, slow rebound to track ruts — balance between the two demands.

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
