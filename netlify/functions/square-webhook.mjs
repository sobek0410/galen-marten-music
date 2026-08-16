// POST /.netlify/functions/square-webhook
// Square calls this on payment.updated. When a payment reaches COMPLETED we
// look up its order (for the Printful variant metadata and the shipping
// address the buyer entered) and create the matching Printful order.
//
// Orders are created as DRAFTS unless AUTO_CONFIRM_ORDERS=true, so nothing
// ships without review while testing.
//
// Env vars: SQUARE_ACCESS_TOKEN, SQUARE_WEBHOOK_SIGNATURE_KEY, PRINTFUL_API_KEY
// Optional: PRINTFUL_STORE_ID, AUTO_CONFIRM_ORDERS, SQUARE_ENV,
//           SQUARE_WEBHOOK_URL (the exact notification URL registered with
//           Square — required for signature verification if it differs from
//           the request URL Netlify reconstructs)

import crypto from 'node:crypto';

const ok = (body = 'ok') => new Response(body, { status: 200 });
const fail = (msg, status = 400) => {
  console.error('square-webhook:', msg);
  return new Response(msg, { status });
};

const squareBase = () =>
  process.env.SQUARE_ENV === 'production'
    ? 'https://connect.squareup.com'
    : 'https://connect.squareupsandbox.com';

// Square signs: base64( HMAC-SHA256( key, notificationUrl + rawBody ) )
function verify(notificationUrl, rawBody, signature, key) {
  if (!signature) return false;
  const expected = crypto
    .createHmac('sha256', key)
    .update(notificationUrl + rawBody)
    .digest('base64');
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export default async (req) => {
  const {
    SQUARE_ACCESS_TOKEN,
    SQUARE_WEBHOOK_SIGNATURE_KEY,
    PRINTFUL_API_KEY,
  } = process.env;
  if (!SQUARE_ACCESS_TOKEN || !SQUARE_WEBHOOK_SIGNATURE_KEY || !PRINTFUL_API_KEY) {
    return fail('Webhook not configured', 503);
  }

  const rawBody = await req.text();
  const notificationUrl = process.env.SQUARE_WEBHOOK_URL || req.url;
  const signature = req.headers.get('x-square-hmacsha256-signature');
  if (!verify(notificationUrl, rawBody, signature, SQUARE_WEBHOOK_SIGNATURE_KEY)) {
    return fail('Invalid signature', 401);
  }

  const event = JSON.parse(rawBody);
  if (event.type !== 'payment.updated' && event.type !== 'payment.created') {
    return ok('ignored');
  }
  const payment = event.data?.object?.payment;
  if (!payment) return ok('no payment in event');
  if (payment.status !== 'COMPLETED') return ok(`payment ${payment.status}, ignoring`);
  const orderId = payment.order_id;
  if (!orderId) return fail('payment has no order_id');

  const sqHeaders = {
    Authorization: `Bearer ${SQUARE_ACCESS_TOKEN}`,
    'Square-Version': '2025-01-23',
    'Content-Type': 'application/json',
  };

  // --- the order carries our metadata + the buyer's shipping address ---
  const ores = await fetch(`${squareBase()}/v2/orders/${orderId}`, { headers: sqHeaders });
  if (!ores.ok) return fail('could not fetch Square order', 502);
  const order = (await ores.json()).order;

  const meta = order.metadata || {};
  const variantId = parseInt(meta.printful_variant_id, 10);
  if (!variantId) return fail('order missing printful_variant_id metadata');
  const quantity = parseInt(meta.quantity, 10) || 1;

  const shipment = (order.fulfillments || []).find((f) => f.type === 'SHIPMENT');
  const recipient = shipment?.shipment_details?.recipient;
  const addr = recipient?.address;
  if (!addr) return fail('order has no shipping address');

  const pfHeaders = {
    Authorization: `Bearer ${PRINTFUL_API_KEY}`,
    'Content-Type': 'application/json',
  };
  if (process.env.PRINTFUL_STORE_ID) pfHeaders['X-PF-Store-Id'] = process.env.PRINTFUL_STORE_ID;

  // Idempotency: one Printful order per Square order. Square retries webhooks,
  // and payment.updated can fire more than once for the same payment.
  const existing = await fetch(`https://api.printful.com/orders/@${orderId}`, {
    headers: pfHeaders,
  });
  if (existing.ok) return ok('order already exists');

  const confirm = process.env.AUTO_CONFIRM_ORDERS === 'true';
  const total = (n) => ((n || 0) / 100).toFixed(2);
  const pfOrder = {
    external_id: orderId,
    confirm,
    recipient: {
      name:
        recipient.display_name ||
        [addr.first_name, addr.last_name].filter(Boolean).join(' ') ||
        'Customer',
      address1: addr.address_line_1,
      address2: addr.address_line_2 || undefined,
      city: addr.locality,
      state_code: addr.administrative_district_level_1,
      country_code: addr.country || 'US',
      zip: addr.postal_code,
      email: recipient.email_address || undefined,
      phone: recipient.phone_number || undefined,
    },
    items: [{ sync_variant_id: variantId, quantity }],
    retail_costs: {
      subtotal: total(order.net_amounts?.total_money?.amount - (order.net_amounts?.service_charge_money?.amount || 0)),
      shipping: total(order.net_amounts?.service_charge_money?.amount),
      total: total(order.net_amounts?.total_money?.amount),
    },
  };

  const pres = await fetch('https://api.printful.com/orders', {
    method: 'POST',
    headers: pfHeaders,
    body: JSON.stringify(pfOrder),
  });
  const pdata = await pres.json();
  if (!pres.ok) {
    // non-2xx tells Square to retry — good for transient Printful errors
    return fail(`Printful order failed: ${JSON.stringify(pdata.error || pdata).slice(0, 200)}`, 502);
  }
  console.log(
    `Printful order ${pdata.result.id} created (${confirm ? 'confirmed' : 'draft'}) for Square order ${orderId}`
  );
  return ok('order created');
};
