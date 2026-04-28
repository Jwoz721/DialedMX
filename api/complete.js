// api/complete.js — Pro tier setup generator (runs after Stripe payment)
// Three critical properties:
//  1. Bike defaults are looked up server-side from the Stripe session's bikeId.
//     The client no longer sends bikeDefaults — this fixes the bug where a user
//     who changed the dropdown between checkout and return got a mis-tuned setup.
//  2. Generation is idempotent: keyed by stripe session_id, cached for 7 days.
//     Refreshing the success page re-serves the cached result instead of
//     burning a second expensive API call.
//  3. Uses Claude Opus 4.7 with extended thinking enabled for higher-quality,
//     better-differentiated variants.

const { buildSystemPrompt, buildUserPrompt } = require('./_prompt');
const { getDefaultsForBike } = require('./_bikeDefaults');
const {
  parseModelJson,
  validateResponse,
  rateLimit,
  getCachedResult,
  setCachedResult,
} = require('./_utils');

const PRO_MODEL = 'claude-opus-4-7';
const MAX_RETRIES_ON_INVALID = 1;
const THINKING_BUDGET = 3000;
const MAX_TOKENS = 8000; // must be > THINKING_BUDGET; leaves ~5k for output

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limit (abuse-hardening even though this path requires paid Stripe session)
  const rl = await rateLimit(req, { max: 20, windowMs: 60_000 });
  if (!rl.success) {
    return res.status(429).json({ error: 'Too many requests. Please wait a moment.' });
  }

  const { sessionId } = req.body || {};
  if (!sessionId) {
    return res.status(400).json({ error: 'Missing session ID' });
  }

  try {
    // -------------------------------------------------------------------
    // 1. IDEMPOTENCY CHECK — if we've already generated for this session,
    //    return the cached result. A refresh of the success URL never burns
    //    a second expensive Opus call.
    // -------------------------------------------------------------------
    const cacheKey = `dialedmx:session:${sessionId}`;
    const cached = await getCachedResult(cacheKey);
    if (cached) {
      return res.status(200).json({ ...cached, cached: true });
    }

    // -------------------------------------------------------------------
    // 2. VERIFY PAYMENT with Stripe
    // -------------------------------------------------------------------
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== 'paid') {
      return res.status(402).json({ error: 'Payment not completed' });
    }

    const { bikeName, bikeId, bikeClass, discipline, skillLevel, trackCondition } = session.metadata || {};
    if (!bikeName || !bikeId || !discipline) {
      return res.status(400).json({ error: 'Session metadata is incomplete' });
    }

    // -------------------------------------------------------------------
    // 3. SERVER-SIDE DEFAULTS LOOKUP (fixes the "wrong bike after checkout"
    //    bug — the client can no longer influence which bike's defaults
    //    are used).
    // -------------------------------------------------------------------
    const bikeDefaults = getDefaultsForBike(bikeId);

    const systemPrompt = buildSystemPrompt({ isPremium: true, bikeDefaults });
    const userPrompt = buildUserPrompt({
      isPremium: true,
      bikeName,
      bikeClass,
      discipline,
      skillLevel,
      trackCondition,
    });

    // -------------------------------------------------------------------
    // 4. GENERATE via Opus 4.7 with extended thinking + validation retry
    // -------------------------------------------------------------------
    const parsed = await generateProWithRetry({ systemPrompt, userPrompt });

    const payload = {
      result: parsed,
      bikeName,
      bikeId,
      bikeClass,
      discipline,
      skillLevel,
      trackCondition,
    };

    // Cache for 7 days so refreshes of the success page are free
    await setCachedResult(cacheKey, payload, 7 * 24 * 3600);

    return res.status(200).json(payload);
  } catch (err) {
    console.error('Complete error:', err);
    return res.status(500).json({
      error: 'Failed to complete. Please contact support with your session ID: ' + sessionId,
    });
  }
};

async function generateProWithRetry({ systemPrompt, userPrompt, attempt = 0 }) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: PRO_MODEL,
      max_tokens: MAX_TOKENS,
      thinking: { type: 'enabled', budget_tokens: THINKING_BUDGET },
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error.message || 'Anthropic API error');

  // Filter to text blocks only — extended thinking responses also contain
  // thinking blocks which we must skip.
  const raw = (data.content || [])
    .filter(c => c.type === 'text')
    .map(c => c.text || '')
    .join('');

  const parsed = parseModelJson(raw);
  const errors = parsed ? validateResponse(parsed, true) : ['model response was not valid JSON'];

  if (errors.length === 0) return parsed;

  if (attempt < MAX_RETRIES_ON_INVALID) {
    console.warn(`[complete] invalid output on attempt ${attempt + 1}, retrying. Errors:`, errors.slice(0, 3));
    const repairPrompt = `${userPrompt}\n\nYour previous response had these issues: ${errors.slice(0, 8).join('; ')}. Return ONLY the corrected JSON array of 3 variants (BASELINE, SOFTER, STIFFER) with every required field inside the specified ranges and respecting the variant differentiation rules.`;
    return generateProWithRetry({
      systemPrompt,
      userPrompt: repairPrompt,
      attempt: attempt + 1,
    });
  }

  throw new Error(`Model returned invalid output after retry: ${errors.slice(0, 3).join('; ')}`);
}
