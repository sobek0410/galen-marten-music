/* Product page checkout: builds a size/color picker from /data/variants.json
   and starts a Stripe Checkout session via the create-checkout function.
   If variants.json doesn't exist yet (Printful/Stripe keys not configured),
   the page quietly keeps its legacy buy link. */

(function () {
  'use strict';

  var buyLink = document.querySelector('.buy-link[data-product-slug]');
  if (!buyLink) return;
  var slug = buyLink.getAttribute('data-product-slug');

  fetch('/data/variants.json')
    .then(function (r) {
      if (!r.ok) throw new Error('no variants file');
      return r.json();
    })
    .then(function (all) {
      var product = all[slug];
      if (!product || !product.variants || !product.variants.length) return;
      build(product);
    })
    .catch(function () {
      /* keep the legacy link */
    });

  function build(product) {
    var variants = product.variants.filter(function (v) {
      return v.availability !== 'discontinued';
    });
    var colors = uniq(variants.map(function (v) { return v.color; }));
    var sizes = uniq(variants.map(function (v) { return v.size; }));

    var buyWrap = buyLink.closest('.buy');
    var form = document.createElement('div');
    form.className = 'variant-form';

    var colorSel = colors.length > 1 ? makeSelect('Color', colors) : null;
    var sizeSel = sizes.length > 1 ? makeSelect('Size', sizes) : null;
    if (colorSel) form.appendChild(colorSel.field);
    if (sizeSel) form.appendChild(sizeSel.field);

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn-solid';
    btn.textContent = 'Buy now';
    form.appendChild(btn);

    var note = document.createElement('p');
    note.className = 'form-note variant-note';
    note.setAttribute('role', 'status');
    form.appendChild(note);

    buyLink.replaceWith(form);

    function current() {
      var c = colorSel ? colorSel.select.value : null;
      var s = sizeSel ? sizeSel.select.value : null;
      return variants.find(function (v) {
        return (!colorSel || v.color === c) && (!sizeSel || v.size === s);
      });
    }

    function refresh() {
      // narrow size options to the chosen color first, so the price below
      // always reflects the final selection
      if (colorSel && sizeSel) {
        var avail = variants
          .filter(function (x) { return x.color === colorSel.select.value; })
          .map(function (x) { return x.size; });
        Array.prototype.forEach.call(sizeSel.select.options, function (o) {
          o.disabled = avail.indexOf(o.value) === -1;
        });
        if (sizeSel.select.selectedOptions[0] && sizeSel.select.selectedOptions[0].disabled) {
          var firstOk = Array.prototype.find.call(sizeSel.select.options, function (o) { return !o.disabled; });
          if (firstOk) sizeSel.select.value = firstOk.value;
        }
      }
      var v = current();
      var priceEl = document.querySelector('.product-info .price');
      if (v && priceEl) priceEl.textContent = '$' + v.price;
      btn.disabled = !v;
      note.textContent = v ? '' : 'That combination isn’t available — try another size or color.';
    }
    if (colorSel) colorSel.select.addEventListener('change', refresh);
    if (sizeSel) sizeSel.select.addEventListener('change', refresh);
    refresh();

    btn.addEventListener('click', function () {
      var v = current();
      if (!v) return;
      btn.disabled = true;
      btn.textContent = 'Starting checkout…';
      fetch('/.netlify/functions/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variantId: v.id, quantity: 1, slug: slug }),
      })
        .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
        .then(function (res) {
          if (res.ok && res.d.url) { window.location.href = res.d.url; return; }
          throw new Error(res.d.error || 'checkout failed');
        })
        .catch(function () {
          btn.disabled = false;
          btn.textContent = 'Buy now';
          note.textContent = 'Something went wrong starting checkout. Please try again, or email gsmarten@gmail.com.';
        });
    });
  }

  function uniq(arr) {
    return arr.filter(function (v, i) { return v && arr.indexOf(v) === i; });
  }

  function makeSelect(label, values) {
    var field = document.createElement('div');
    field.className = 'field';
    var id = 'opt-' + label.toLowerCase();
    var lab = document.createElement('label');
    lab.setAttribute('for', id);
    lab.textContent = label;
    var select = document.createElement('select');
    select.id = id;
    values.forEach(function (val) {
      var o = document.createElement('option');
      o.value = val;
      o.textContent = val;
      select.appendChild(o);
    });
    field.appendChild(lab);
    field.appendChild(select);
    return { field: field, select: select };
  }
})();
