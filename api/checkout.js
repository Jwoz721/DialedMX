// api/checkout.js
// Creates a Stripe Checkout session for the Pro setup
// Stores setup params in session metadata so we can generate after payment

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { bikeName, bikeId, bikeClass, discipline, skillLevel, trackCondition } = req.body;

  if (!bikeName || !discipline) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price: process.env.STRIPE_PRICE_ID,
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.SITE_URL}?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.SITE_URL}?cancelled=true`,
      metadata: {
        bikeName,
        bikeId,
        bikeClass,
        discipline,
        skillLevel,
        trackCondition,
      },
    });

    return res.status(200).json({ url: session.url });

  } catch (err) {
    console.error('Stripe checkout error:', err);
    return res.status(500).json({ error: err.message });
  }
};
