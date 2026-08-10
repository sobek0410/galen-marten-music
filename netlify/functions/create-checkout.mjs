// POST /.netlify/functions/create-checkout
// Body: { variantId: <printful sync_variant_id>, quantity?: number, slug: "<product slug>" }
// Looks the variant up in Printful (source of truth for price/name — never
// trusts client-supplied prices), creates a Stripe Checkout Session, and
// returns { url } to redirect the buyer to.
//
// Env vars (set in Netlify): PRINTFUL_API_KEY, STRIPE_SECRET_KEY,
// optional PRINTFUL_STORE_ID, SHIPPING_FLAT_CENTS (default 499).

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export default async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  const PRINTFUL_API_KEY = process.env.PRINTFUL_API_KEY;
  const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;
  if (!PRINTFUL_API_KEY || !STRIPE_SECRET_KEY) {
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

  // --- look up the variant in Printful ---
  const pfHeaders = { Authorization: `Bearer ${PRINTFUL_API_KEY}` };
  if (process.env.PRINTFUL_STORE_ID) pfHeaders['X-PF-Store-Id'] = process.env.PRINTFUL_STORE_ID;
  const vres = await fetch(`https://api.printful.com/store/variants/${variantId}`, { headers: pfHeaders });
  if (!vres.ok) return json({ error: 'Unknown product variant' }, 400);
  const variant = (await vres.json()).result;
  const unitAmount = Math.round(parseFloat(variant.retail_price) * 100);
  if (!unitAmount || unitAmount < 50) return json({ error: 'Variant has no price' }, 400);
  const preview = (variant.files || []).find((f) => f.type === 'preview');

  // --- create the Stripe Checkout Session ---
  const site = process.env.URL || 'https://galen-marten-music-staging.netlify.app';
  const p = new URLSearchParams();
  p.append('mode', 'payment');
  p.append('success_url', `${site}/merch/thanks/?session_id={CHECKOUT_SESSION_ID}`);
  p.append('cancel_url', slug ? `${site}/merch/${slug}/` : `${site}/merch/`);
  p.append('line_items[0][quantity]', String(quantity));
  p.append('line_items[0][adjustable_quantity][enabled]', 'true');
  p.append('line_items[0][adjustable_quantity][minimum]', '1');
  p.append('line_items[0][adjustable_quantity][maximum]', '10');
  p.append('line_items[0][price_data][currency]', 'usd');
  p.append('line_items[0][price_data][unit_amount]', String(unitAmount));
  p.append('line_items[0][price_data][product_data][name]', variant.name || 'Galen Marten Music merch');
  if (preview && preview.preview_url) {
    p.append('line_items[0][price_data][product_data][images][0]', preview.preview_url);
  }
  p.append('shipping_address_collection[allowed_countries][0]', 'US');
  const ship = parseInt(process.env.SHIPPING_FLAT_CENTS || '499', 10);
  p.append('shipping_options[0][shipping_rate_data][type]', 'fixed_amount');
  p.append('shipping_options[0][shipping_rate_data][display_name]', 'Standard shipping');
  p.append('shipping_options[0][shipping_rate_data][fixed_amount][amount]', String(ship));
  p.append('shipping_options[0][shipping_rate_data][fixed_amount][currency]', 'usd');
  p.append('phone_number_collection[enabled]', 'false');
  p.append('metadata[printful_variant_id]', String(variantId));
  p.append('metadata[product_slug]', slug);

  const sres = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: p,
  });
  const session = await sres.json();
  if (!sres.ok) {
    console.error('Stripe error:', session.error && session.error.message);
    return json({ error: 'Could not start checkout' }, 502);
  }
  return json({ url: session.url });
};
