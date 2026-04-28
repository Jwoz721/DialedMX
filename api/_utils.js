// api/_utils.js
// Shared helpers: JSON recovery, schema validation, rate limiting, result caching.
// Rate limiting and caching use Upstash Redis when env vars are present, and
// fall back to per-instance in-memory when they aren't (so the app still works
// without setup, but at reduced effectiveness — set UPSTASH_* for production).

// -------------------------------------------------------------------------
// JSON RECOVERY
// -------------------------------------------------------------------------
function parseModelJson(raw) {
  if (!raw || typeof raw !== 'string') return null;

  // Strip markdown fences if present
  const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();

  // Try 1: parse cleaned text directly
  try { return JSON.parse(cleaned); } catch {}

  // Try 2: find the first balanced [...] or {...} and parse that
  const extractBalanced = (open, close) => {
    const start = cleaned.indexOf(open);
    if (start === -1) return null;
    let depth = 0;
    let inString = false;
    let escape = false;
    for (let i = start; i < cleaned.length; i++) {
      const ch = cleaned[i];
      if (escape) { escape = false; continue; }
      if (ch === '\\') { escape = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === open) depth++;
      else if (ch === close) {
        depth--;
        if (depth === 0) {
          try { return JSON.parse(cleaned.slice(start, i + 1)); } catch { return null; }
        }
      }
    }
    return null;
  };

  return extractBalanced('[', ']') || extractBalanced('{', '}') || null;
}

// -------------------------------------------------------------------------
// SCHEMA VALIDATION
// -------------------------------------------------------------------------
const RANGES = {
  frontSpring:       [4.0, 6.0],
  frontCompression:  [1, 20],
  frontRebound:      [1, 20],
  frontPreload:      [0, 10],
  forkHeight:        [0, 15],
  forkOffset:        [20, 30],
  rearSpring:        [30, 60],
  rearLSC:           [1, 20],
  rearHSC:           [0, 4],
  rearRebound:       [1, 30],
  rearPreload:       [0, 10],
  swingarmLength:    [1, 10],
  rearSprocket:      [47, 57],
  frontTyrePressure: [10, 18],
  rearTyrePressure:  [9, 18],
};

function validateSetup(setup) {
  const errors = [];
  if (!setup || typeof setup !== 'object') return ['setup is not an object'];

  for (const [key, [min, max]] of Object.entries(RANGES)) {
    const v = setup[key];
    if (typeof v !== 'number' || Number.isNaN(v) || v < min || v > max) {
      errors.push(`${key}=${v} out of range [${min}, ${max}]`);
    }
  }
  if (!['Race', 'Standard'].includes(setup.engineMapping)) {
    errors.push(`engineMapping must be "Race" or "Standard", got ${setup.engineMapping}`);
  }
  return errors;
}

function validateResponse(parsed, isPremium) {
  if (isPremium) {
    if (!Array.isArray(parsed)) return ['expected array of 3 variants'];
    if (parsed.length !== 3) return [`expected 3 variants, got ${parsed.length}`];
    const errors = [];
    const names = parsed.map(v => v && v.variantName);
    const expected = ['BASELINE', 'SOFTER', 'STIFFER'];
    for (const n of expected) {
      if (!names.includes(n)) errors.push(`missing variant: ${n}`);
    }
    parsed.forEach((v, i) => {
      const setupErrors = validateSetup(v);
      setupErrors.forEach(e => errors.push(`variant[${i}] (${v && v.variantName}): ${e}`));
    });
    return errors;
  }
  return validateSetup(parsed);
}

// -------------------------------------------------------------------------
// RATE LIMITING
// -------------------------------------------------------------------------
let upstashLimiter = null;
let upstashRedis = null;

function initUpstash() {
  if (upstashLimiter !== null) return; // already attempted
  upstashLimiter = false; // sentinel so we don't retry every call

  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    console.warn('[dialedmx] UPSTASH_REDIS_REST_* not set — using in-memory fallback for rate limit + cache');
    return;
  }

  try {
    const { Ratelimit } = require('@upstash/ratelimit');
    const { Redis } = require('@upstash/redis');
    upstashRedis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    upstashLimiter = new Ratelimit({
      redis: upstashRedis,
      limiter: Ratelimit.slidingWindow(10, '60 s'),
      prefix: 'dialedmx:rl',
    });
  } catch (e) {
    console.warn('[dialedmx] Upstash packages not installed — using in-memory fallback:', e.message);
    upstashLimiter = false;
    upstashRedis = null;
  }
}

// In-memory fallback (per-instance; imperfect on serverless but better than nothing)
const memHits = new Map();
function memRateLimit(ip, max, windowMs) {
  const now = Date.now();
  const hits = (memHits.get(ip) || []).filter(t => now - t < windowMs);
  hits.push(now);
  memHits.set(ip, hits);
  if (memHits.size > 2000) {
    for (const [k, v] of memHits) {
      if (!v.some(t => now - t < windowMs)) memHits.delete(k);
    }
  }
  return { success: hits.length <= max, remaining: Math.max(0, max - hits.length) };
}

function getClientIp(req) {
  const fwd = req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || '';
  return String(fwd).split(',')[0].trim() || 'anon';
}

async function rateLimit(req, { max = 10, windowMs = 60_000 } = {}) {
  initUpstash();
  const ip = getClientIp(req);
  if (upstashLimiter && upstashLimiter !== false) {
    try {
      const r = await upstashLimiter.limit(ip);
      return { success: r.success, remaining: r.remaining, ip };
    } catch (e) {
      console.warn('[dialedmx] rate limit error, falling through:', e.message);
    }
  }
  return { ...memRateLimit(ip, max, windowMs), ip };
}

// -------------------------------------------------------------------------
// IDEMPOTENT RESULT CACHE (keyed by Stripe session_id)
// -------------------------------------------------------------------------
const memCache = new Map();

async function getCachedResult(key) {
  initUpstash();
  if (upstashRedis) {
    try {
      const v = await upstashRedis.get(key);
      if (v == null) return null;
      // @upstash/redis auto-parses JSON but be defensive
      return typeof v === 'string' ? JSON.parse(v) : v;
    } catch (e) {
      console.warn('[dialedmx] cache get failed:', e.message);
    }
  }
  const entry = memCache.get(key);
  if (entry && entry.expires > Date.now()) return entry.value;
  if (entry) memCache.delete(key);
  return null;
}

async function setCachedResult(key, value, ttlSeconds = 7 * 24 * 3600) {
  initUpstash();
  if (upstashRedis) {
    try {
      await upstashRedis.set(key, JSON.stringify(value), { ex: ttlSeconds });
      return;
    } catch (e) {
      console.warn('[dialedmx] cache set failed:', e.message);
    }
  }
  memCache.set(key, { value, expires: Date.now() + ttlSeconds * 1000 });
  if (memCache.size > 500) {
    const now = Date.now();
    for (const [k, v] of memCache) if (v.expires < now) memCache.delete(k);
  }
}

module.exports = {
  parseModelJson,
  validateSetup,
  validateResponse,
  rateLimit,
  getCachedResult,
  setCachedResult,
  getClientIp,
};
