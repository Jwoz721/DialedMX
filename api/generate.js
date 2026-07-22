// Vercel Serverless Function — /api/generate
// Your Anthropic API key lives ONLY here as an environment variable.
// Set it in Vercel Dashboard → Project → Settings → Environment Variables
// Variable name: ANTHROPIC_API_KEY

const { parseModelJson, rateLimit } = require('./_utils');
const { buildSystemPrompt, buildUserPrompt } = require('./_prompt');
const { getDefaultsForBike } = require('./_bikeDefaults');

module.exports = async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const rl = await rateLimit(req, { max: 5, windowMs: 60_000 });
  if (!rl.success) {
    return res.status(429).json({ error: 'Too many requests. Please wait a minute and try again.' });
  }

  const { bikeName, bikeId, bikeClass, discipline, tier, skillLevel, trackCondition, bikeDefaults } = req.body;

  if (!bikeName || !discipline || !tier) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const isPremium = tier === 'premium';

  // Defaults resolved server-side from bikeId; the client-supplied blob is
  // only a fallback for stale cached clients that don't send bikeId yet.
  const systemPrompt = buildSystemPrompt({
    isPremium,
    bikeDefaults: getDefaultsForBike(bikeId) || bikeDefaults || null,
  });
  const userPrompt = buildUserPrompt({ isPremium, bikeName, bikeClass, discipline, skillLevel, trackCondition });

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: isPremium ? 'claude-opus-4-8' : 'claude-sonnet-4-6',
        max_tokens: isPremium ? 4000 : 1600,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }]
      })
    });

    const data = await response.json();

    if (data.error) {
      return res.status(500).json({ error: data.error.message });
    }

    const raw = data.content.map(c => c.text || '').join('');
    const parsed = parseModelJson(raw);
    if (!parsed) {
      console.error('Generate parse failed. Raw head:', raw.slice(0, 500));
      return res.status(502).json({ error: 'Failed to read the generated setup. Please try again.' });
    }

    return res.status(200).json({ result: parsed, isPremium });

  } catch (err) {
    console.error('Generate error:', err);
    return res.status(500).json({ error: 'Failed to generate setup. Please try again.' });
  }
}
