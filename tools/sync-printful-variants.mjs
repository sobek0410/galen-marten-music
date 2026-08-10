#!/usr/bin/env node
// Pulls every sync product + variant from Printful and writes
// site/data/variants.json, which powers the size/color picker on product
// pages. Run whenever products change in Printful:
//
//   PRINTFUL_API_KEY=xxxx node tools/sync-printful-variants.mjs
//   (add PRINTFUL_STORE_ID=nnn if the token can see multiple stores)
//
// Products are matched to the site's merch slugs by name. Anything that
// can't be matched is printed for manual mapping in SLUG_OVERRIDES below.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const KEY = process.env.PRINTFUL_API_KEY;
if (!KEY) {
  console.error('Set PRINTFUL_API_KEY');
  process.exit(1);
}
const HEADERS = { Authorization: `Bearer ${KEY}` };
if (process.env.PRINTFUL_STORE_ID) HEADERS['X-PF-Store-Id'] = process.env.PRINTFUL_STORE_ID;

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'site', 'data', 'variants.json');

// site slug -> printful sync product name, for anything fuzzy matching misses
const SLUG_OVERRIDES = {
  // 'dad-hat-1': 'Galen Marten Music Embroidered Hat',
};

const norm = (s) =>
  s.toLowerCase().replace(/[“”"']/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

async function pf(url) {
  const res = await fetch(`https://api.printful.com${url}`, { headers: HEADERS });
  if (!res.ok) throw new Error(`${url} -> ${res.status}: ${await res.text()}`);
  return (await res.json()).result;
}

const siteProducts = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'site', 'data', 'products.json'))
);

// 1. list all sync products (paginated)
let products = [];
for (let offset = 0; ; offset += 100) {
  const page = await pf(`/store/products?limit=100&offset=${offset}`);
  products = products.concat(page);
  if (page.length < 100) break;
}
console.log(`Printful sync products: ${products.length}`);

// 2. fetch variants per product
const out = {};
const unmatched = [];
for (const p of products) {
  const detail = await pf(`/store/products/${p.id}`);
  const pfName = detail.sync_product.name;

  // match to a site slug
  let slug = Object.keys(SLUG_OVERRIDES).find((k) => SLUG_OVERRIDES[k] === pfName);
  if (!slug) {
    const hit = siteProducts.find((sp) => norm(sp.name) === norm(pfName));
    if (hit) slug = hit.slug;
  }
  if (!slug) {
    // fuzzy: site name contained in printful name or vice versa
    const hit = siteProducts.find(
      (sp) => norm(pfName).includes(norm(sp.name)) || norm(sp.name).includes(norm(pfName))
    );
    if (hit) slug = hit.slug;
  }
  if (!slug) {
    unmatched.push(pfName);
    continue;
  }

  const variants = detail.sync_variants
    .filter((v) => !v.is_ignored)
    .map((v) => {
      // sync variant names look like "Product name / Color / Size" or
      // "Product name / Size" — parse the segments after the product name
      const segs = v.name.split('/').map((s) => s.trim()).slice(1);
      let color = null;
      let size = null;
      if (segs.length === 2) [color, size] = segs;
      else if (segs.length === 1) {
        // single-axis products: sizes look like S/M/L/XL/2XL or "One size"
        if (/^(x{0,3}s|s|m|l|x{1,3}l|\d?xl|one size|\d+)$/i.test(segs[0])) size = segs[0];
        else color = segs[0];
      }
      return {
        id: v.id,
        sku: v.sku || null,
        color,
        size,
        price: v.retail_price,
        availability: v.availability_status || 'active',
      };
    });

  out[slug] = { printful_product_id: p.id, name: pfName, variants };
  console.log(`  ${slug}  <-  "${pfName}"  (${variants.length} variants)`);
}

if (unmatched.length) {
  console.warn('\nUNMATCHED Printful products (add to SLUG_OVERRIDES if needed):');
  unmatched.forEach((n) => console.warn('  -', n));
}

fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log(`\nWrote ${OUT}`);
