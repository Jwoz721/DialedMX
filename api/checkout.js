// api/checkout.js
// Creates a Stripe Checkout session for the Pro setup.
// Stores setup params in session metadata so complete.js can generate after payment.

const { rateLimit } = require('./_utils');

const VALID_DISCIPLINES = new Set(['SX', 'MX']); // Enduro/Hard Enduro removed from UI until benchmarks exist
const VALID_SKILLS = new Set(['Beginner', 'Intermediate', 'Advanced', 'Pro']);

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const rl = await rateLimit(req, { max: 20, windowMs: 60_000 });
  if (!rl.success) {
    return res.status(429).json({ error: 'Too many requests. Please wait a moment.' });
  }

  const { bikeName, bikeId, bikeClass, discipline, skillLevel, trackCondition } = req.body || {};

  if (!bikeName || !bikeId || !discipline) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  if (!VALID_DISCIPLINES.has(discipline)) {
    return res.status(400).json({ error: 'Invalid discipline' });
  }
  if (skillLevel && !VALID_SKILLS.has(skillLevel)) {
    return res.status(400).json({ error: 'Invalid skill level' });
  }

  try {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      mode: 'payment',
      success_url: `${process.env.SITE_URL}?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.SITE_URL}?cancelled=true`,
      metadata: {
        bikeName,
        bikeId,
        bikeClass: bikeClass || '',
        discipline,
        skillLevel: skillLevel || 'Intermediate',
        trackCondition: trackCondition || 'Hard Pack',
      },
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('Stripe checkout error:', err);
    return res.status(500).json({ error: err.message });
  }
};
