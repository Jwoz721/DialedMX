// Vercel Serverless Function — /api/generate
// Your Anthropic API key lives ONLY here as an environment variable.
// Set it in Vercel Dashboard → Project → Settings → Environment Variables
// Variable name: ANTHROPIC_API_KEY

module.exports = async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { bikeName, bikeClass, discipline, tier, skillLevel, trackCondition, bikeDefaults } = req.body;

  if (!bikeName || !discipline || !tier) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const isPremium = tier === 'premium';

  // Format bike defaults for the prompt if available
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
SX — Supercross: Stiffer springs (front 5.0–5.3, rear 50–55), controlled compression for jump faces/landings, moderate rebound, lower fork height (4–7mm) for precise cornering, firmer tyres (index 13–15), Race mapping. Setup must handle rhythm sections, big jumps, and tight berms.
MX — Motocross: Mid-range springs (front 4.8–5.2, rear 48–53), softer compression for rough terrain and whoops, faster rebound to recover over bumps, medium fork height (6–10mm), standard tyre pressure (index 12–13), Race mapping.
Enduro: Softer springs (front 4.5–5.0, rear 44–50), very compliant compression, medium-slow rebound for traction, higher fork height (8–12mm), lower tyre pressure for grip, Race or Standard mapping.
Hard Enduro: Softest setup (front 4.0–4.8, rear 38–46), maximum compliance, slow rebound for rock/root traction, high fork height, lowest tyre pressure, Standard mapping.

${defaultsContext}

${isPremium ? `
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
Rough/Choppy: Softer HSC to absorb chop, faster rebound to recover, stiffer LSC.
Mud: Very soft everything, lowest tyre pressure, Standard mapping for smooth power.
` : ''}

You MUST respond with ONLY valid JSON — no markdown, no backticks, no explanation outside the JSON.
${isPremium ? `
Return THREE setup variants as an array:
[
  { ...setup, "fuel": number, "variantName": "BASELINE", "notes": "..." },
  { ...setup, "variantName": "SOFTER", "notes": "..." },
  { ...setup, "variantName": "STIFFER", "notes": "..." }
]
Each variant should be meaningfully different — not just 1 click off. SOFTER prioritizes comfort and traction, STIFFER prioritizes lap time and precision.
` : `
Return a single setup object:
{ frontSpring, frontCompression, frontRebound, frontPreload, forkHeight, forkOffset, rearSpring, rearLSC, rearHSC, rearRebound, rearPreload, swingarmLength, rearSprocket, engineMapping, frontTyrePressure, rearTyrePressure, "fuel": number, "notes": "2-3 sentence tuner note" }
`}`;

  const userPrompt = isPremium
    ? `Generate 3 ${discipline} suspension setup variants for the ${bikeName} (${bikeClass}) in MX Bikes. Rider skill: ${skillLevel}. Track conditions: ${trackCondition}. Each variant must be optimized for these specific conditions.`
    : `Generate a solid base ${discipline} suspension setup for the ${bikeName} (${bikeClass}) in MX Bikes. This is a general purpose setup that works across most tracks and conditions — reliable and well-rounded.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: isPremium ? 2500 : 1000,
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

    return res.status(200).json({ result: parsed, isPremium });

  } catch (err) {
    console.error('Generate error:', err);
    return res.status(500).json({ error: 'Failed to generate setup. Please try again.' });
  }
}
