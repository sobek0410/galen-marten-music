// POST /.netlify/functions/create-checkout
// Body: { variantId: <printful sync_variant_id>, quantity?: number, slug: "<product slug>" }
//
// Looks the variant up in Printful (price source of truth — never trusts a
// client-supplied price), then creates a Square hosted Payment Link and returns
// { url } for the browser to redirect to. Square collects card / Apple Pay /
// Google Pay / Cash App Pay and the shipping address; the square-webhook
// function turns the completed payment into a Printful order.
//
// Env vars: PRINTFUL_API_KEY, SQUARE_ACCESS_TOKEN, SQUARE_LOCATION_ID
// Optional: PRINTFUL_STORE_ID, SHIPPING_FLAT_CENTS (default 499),
//           SQUARE_ENV ("sandbox" | "production", default sandbox)

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const squareBase = () =>
  process.env.SQUARE_ENV === 'production'
    ? 'https://connect.squareup.com'
    : 'https://connect.squareupsandbox.com';

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const { PRINTFUL_API_KEY, SQUARE_ACCESS_TOKEN, SQUARE_LOCATION_ID } = process.env;
  if (!PRINTFUL_API_KEY || !SQUARE_ACCESS_TOKEN || !SQUARE_LOCATION_ID) {
    return json({ error: 'Checkout is not configured yet' }, 503);
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid request' }, 400);
  }
  const variantId = parseInt(body.variantId, 10);
  const quantity = Math.min(Math.max(parseInt(body.quantity, 10) || 1, 1), 10);
  const slug = String(body.slug || '').replace(/[^a-z0-9-]/g, '');
  if (!variantId) return json({ error: 'Missing variant' }, 400);

  // --- price + name from Printful ---
  const pfHeaders = { Authorization: `Bearer ${PRINTFUL_API_KEY}` };
  if (process.env.PRINTFUL_STORE_ID) pfHeaders['X-PF-Store-Id'] = process.env.PRINTFUL_STORE_ID;
  const vres = await fetch(`https://api.printful.com/store/variants/${variantId}`, {
    headers: pfHeaders,
  });
  if (!vres.ok) return json({ error: 'Unknown product variant' }, 400);
  const variant = (await vres.json()).result;
  const unitAmount = Math.round(parseFloat(variant.retail_price) * 100);
  if (!unitAmount || unitAmount < 50) return json({ error: 'Variant has no price' }, 400);

  // --- Square payment link ---
  const site = process.env.URL || 'https://galen-marten-music-staging.netlify.app';
  const shipping = parseInt(process.env.SHIPPING_FLAT_CENTS || '499', 10);

  const payload = {
    idempotency_key: crypto.randomUUID(),
    order: {
      location_id: SQUARE_LOCATION_ID,
      line_items: [
        {
          name: variant.name || 'Galen Marten Music merch',
          quantity: String(quantity),
          base_price_money: { amount: unitAmount, currency: 'USD' },
        },
      ],
      service_charges: [
        {
          name: 'Standard shipping',
          amount_money: { amount: shipping, currency: 'USD' },
          calculation_phase: 'TOTAL_PHASE',
        },
      ],
      // read back by the webhook to build the Printful order
      metadata: {
        printful_variant_id: String(variantId),
        product_slug: slug,
        quantity: String(quantity),
      },
    },
    checkout_options: {
      ask_for_shipping_address: true,
      redirect_url: `${site}/merch/thanks/`,
      accepted_payment_methods: {
        apple_pay: true,
        google_pay: true,
        cash_app_pay: true,
        afterpay_clearpay: false,
      },
    },
  };

  const sres = await fetch(`${squareBase()}/v2/online-checkout/payment-links`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${SQUARE_ACCESS_TOKEN}`,
      'Square-Version': '2025-01-23',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
  const data = await sres.json();
  if (!sres.ok) {
    console.error('Square error:', JSON.stringify(data.errors || data).slice(0, 400));
    return json({ error: 'Could not start checkout' }, 502);
  }
  return json({ url: data.payment_link.url });
};
