// api/generate.js — Free tier setup generator
// Your Anthropic API key lives ONLY here as an environment variable.
// Set it in Vercel Dashboard → Project → Settings → Environment Variables
// Variable name: ANTHROPIC_API_KEY
//
// Optional env vars for production:
//   UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN  (enables durable rate limit + cache)

const { buildSystemPrompt, buildUserPrompt } = require('./_prompt');
const { getDefaultsForBike } = require('./_bikeDefaults');
const { parseModelJson, validateResponse, rateLimit } = require('./_utils');

const FREE_MODEL = 'claude-sonnet-4-6';
const MAX_RETRIES_ON_INVALID = 1;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limit: 10 requests per minute per IP (defends free endpoint from abuse)
  const rl = await rateLimit(req, { max: 10, windowMs: 60_000 });
  if (!rl.success) {
    return res.status(429).json({ error: 'Too many requests. Please wait a moment and try again.' });
  }

  const { bikeName, bikeId, bikeClass, discipline } = req.body || {};

  if (!bikeName || !bikeId || !discipline) {
    return res.status(400).json({ error: 'Missing required fields (bikeName, bikeId, discipline)' });
  }

  // Server-side defaults lookup — the client no longer supplies these.
  // This guarantees the prompt anchors to the correct bike regardless of any
  // client-side tampering.
  const bikeDefaults = getDefaultsForBike(bikeId);

  const systemPrompt = buildSystemPrompt({ isPremium: false, bikeDefaults });
  const userPrompt   = buildUserPrompt({ isPremium: false, bikeName, bikeClass, discipline });

  try {
    const parsed = await generateWithRetry({
      systemPrompt,
      userPrompt,
      isPremium: false,
    });

    return res.status(200).json({ result: parsed, isPremium: false });
  } catch (err) {
    console.error('Generate error:', err);
    return res.status(500).json({ error: err.message || 'Failed to generate setup. Please try again.' });
  }
};

// Internal: call Anthropic and retry once if the response is unparseable or
// fails schema validation. This catches the occasional stray comma, markdown
// fence, or out-of-range value without the user seeing a failure.
async function generateWithRetry({ systemPrompt, userPrompt, isPremium, attempt = 0 }) {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: FREE_MODEL,
      max_tokens: 1500,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error.message || 'Anthropic API error');

  const raw = (data.content || [])
    .filter(c => c.type === 'text')
    .map(c => c.text || '')
    .join('');

  const parsed = parseModelJson(raw);
  const errors = parsed ? validateResponse(parsed, isPremium) : ['model response was not valid JSON'];

  if (errors.length === 0) return parsed;

  if (attempt < MAX_RETRIES_ON_INVALID) {
    console.warn(`[generate] invalid output on attempt ${attempt + 1}, retrying. Errors:`, errors.slice(0, 3));
    const repairPrompt = `${userPrompt}\n\nYour previous response had these issues: ${errors.slice(0, 5).join('; ')}. Return ONLY the corrected JSON with every required field inside the specified ranges.`;
    return generateWithRetry({
      systemPrompt,
      userPrompt: repairPrompt,
      isPremium,
      attempt: attempt + 1,
    });
  }

  throw new Error(`Model returned invalid output: ${errors.slice(0, 3).join('; ')}`);
}
