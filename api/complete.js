// api/complete.js
// Verifies Stripe payment and generates the Pro setup
// Called after successful payment redirect

const { parseModelJson, rateLimit, getCachedResult, setCachedResult } = require('./_utils');
const { buildSystemPrompt, buildUserPrompt } = require('./_prompt');
const { getDefaultsForBike } = require('./_bikeDefaults');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const rl = await rateLimit(req, { max: 10, windowMs: 60_000 });
  if (!rl.success) {
    return res.status(429).json({ error: 'Too many requests. Please wait a moment.' });
  }

  const { sessionId } = req.body;

  if (!sessionId) {
    return res.status(400).json({ error: 'Missing session ID' });
  }

  try {
    // 0. Idempotency: same Stripe session always returns the same setups,
    // with no repeat Anthropic spend (refresh of the success URL, replays).
    const cacheKey = `dialedmx:result:${sessionId}`;
    const cached = await getCachedResult(cacheKey);
    if (cached) {
      return res.status(200).json(cached);
    }

    // 1. Verify payment with Stripe
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== 'paid') {
      return res.status(402).json({ error: 'Payment not completed' });
    }

    // 2. Extract setup params from session metadata
    const { bikeName, bikeId, bikeClass, discipline, skillLevel, trackCondition } = session.metadata;

    // 3. Build prompts from the shared modules — bike defaults resolved
    // server-side from the session's bikeId, never from the client.
    const systemPrompt = buildSystemPrompt({
      isPremium: true,
      bikeDefaults: getDefaultsForBike(bikeId),
    });
    const userPrompt = buildUserPrompt({ isPremium: true, bikeName, bikeClass, discipline, skillLevel, trackCondition });

    // 4. Generate the Pro setup via Anthropic
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-opus-4-8',
        max_tokens: 5000,
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
      console.error('Pro parse failed. Raw head:', raw.slice(0, 500));
      return res.status(502).json({ error: 'Setup generated but could not be read back. Please contact support with your session ID: ' + sessionId });
    }

    const payload = {
      result: parsed,
      bikeName,
      bikeId,
      bikeClass,
      discipline
    };
    await setCachedResult(cacheKey, payload);
    return res.status(200).json(payload);

  } catch (err) {
    console.error('Complete error:', err);
    return res.status(500).json({ error: 'Failed to complete. Please contact support.' });
  }
};
