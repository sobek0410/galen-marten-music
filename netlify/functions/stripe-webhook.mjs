// POST /.netlify/functions/stripe-webhook
// Stripe calls this on checkout.session.completed. After verifying the
// signature, it looks up the paid session's line items + shipping address
// and creates the matching Printful order (as a DRAFT unless
// AUTO_CONFIRM_ORDERS=true, so nothing ships without review while testing).
//
// Env vars: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, PRINTFUL_API_KEY,
// optional PRINTFUL_STORE_ID, AUTO_CONFIRM_ORDERS ("true" to auto-fulfill).

import crypto from 'node:crypto';

const ok = (body = 'ok') => new Response(body, { status: 200 });
const fail = (msg, status = 400) => {
  console.error('stripe-webhook:', msg);
  return new Response(msg, { status });
};

function verifySignature(payload, header, secret) {
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(',').map((kv) => kv.split('=').map((s) => s.trim()))
  );
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) return false;
  // reject events older than 5 minutes (replay protection)
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${timestamp}.${payload}`)
    .digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

export default async (req) => {
  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
  const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
  const PRINTFUL_API_KEY = process.env.PRINTFUL_API_KEY;
  if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET || !PRINTFUL_API_KEY) {
    return fail('Webhook not configured', 503);
  }

  const payload = await req.text();
  if (!verifySignature(payload, req.headers.get('stripe-signature'), STRIPE_WEBHOOK_SECRET)) {
    return fail('Invalid signature', 400);
  }

  const event = JSON.parse(payload);
  if (event.type !== 'checkout.session.completed') return ok('ignored');
  const sessionId = event.data.object.id;

  // Fetch the full session — quantities can change inside Stripe Checkout
  // (adjustable_quantity), so the event snapshot isn't enough.
  const sres = await fetch(
    `https://api.stripe.com/v1/checkout/sessions/${sessionId}?expand[]=line_items`,
    { headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` } }
  );
  if (!sres.ok) return fail('Could not fetch session', 502);
  const session = await sres.json();

  if (session.payment_status !== 'paid') return ok('not paid, ignoring');
  const variantId = parseInt(session.metadata && session.metadata.printful_variant_id, 10);
  if (!variantId) return fail('Session missing printful_variant_id metadata');
  const quantity =
    (session.line_items && session.line_items.data[0] && session.line_items.data[0].quantity) || 1;

  // Shipping details moved between Stripe API versions — check both spots.
  const shipping =
    session.shipping_details ||
    (session.collected_information && session.collected_information.shipping_details);
  const customer = session.customer_details || {};
  const addr = (shipping && shipping.address) || customer.address;
  const name = (shipping && shipping.name) || customer.name;
  if (!addr || !name) return fail('Session has no shipping address');

  const pfHeaders = {
    Authorization: `Bearer ${PRINTFUL_API_KEY}`,
    'Content-Type': 'application/json',
  };
  if (process.env.PRINTFUL_STORE_ID) pfHeaders['X-PF-Store-Id'] = process.env.PRINTFUL_STORE_ID;

  // Idempotency: one Printful order per Stripe session. Stripe retries
  // webhooks, so check for an existing order first.
  const existing = await fetch(`https://api.printful.com/orders/@${sessionId}`, {
    headers: pfHeaders,
  });
  if (existing.ok) return ok('order already exists');

  const confirm = process.env.AUTO_CONFIRM_ORDERS === 'true';
  const order = {
    external_id: sessionId,
    confirm,
    recipient: {
      name,
      address1: addr.line1,
      address2: addr.line2 || undefined,
      city: addr.city,
      state_code: addr.state,
      country_code: addr.country,
      zip: addr.postal_code,
      email: customer.email || undefined,
      phone: customer.phone || undefined,
    },
    items: [{ sync_variant_id: variantId, quantity }],
    retail_costs: {
      subtotal: (session.amount_subtotal / 100).toFixed(2),
      shipping: ((session.total_details && session.total_details.amount_shipping) / 100 || 0).toFixed(2),
      total: (session.amount_total / 100).toFixed(2),
    },
  };

  const pres = await fetch('https://api.printful.com/orders', {
    method: 'POST',
    headers: pfHeaders,
    body: JSON.stringify(order),
  });
  const pdata = await pres.json();
  if (!pres.ok) {
    // Non-200 tells Stripe to retry later — good for transient Printful errors.
    return fail(`Printful order failed: ${pdata && pdata.error && pdata.error.message}`, 502);
  }
  console.log(
    `Printful order ${pdata.result.id} created (${confirm ? 'confirmed' : 'draft'}) for session ${sessionId}`
  );
  return ok('order created');
};
