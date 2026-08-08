/* Galen Marten Music — site JS
   Small, dependency-free. Handles: nav, shows (from /data/shows.json),
   lazy YouTube embeds, scroll reveals, product galleries, forms. */

(function () {
  'use strict';

  var d = document;

  /* ---------- Mobile nav ---------- */
  var toggle = d.querySelector('.nav-toggle');
  if (toggle) {
    toggle.addEventListener('click', function () {
      var open = d.body.classList.toggle('nav-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  /* ---------- Desktop dropdowns ---------- */
  d.querySelectorAll('.has-menu > button').forEach(function (btn) {
    var li = btn.parentElement;
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      var wasOpen = li.classList.contains('open');
      d.querySelectorAll('.has-menu.open').forEach(function (o) { o.classList.remove('open'); });
      li.classList.toggle('open', !wasOpen);
      btn.setAttribute('aria-expanded', String(!wasOpen));
    });
  });
  d.addEventListener('click', function () {
    d.querySelectorAll('.has-menu.open').forEach(function (o) {
      o.classList.remove('open');
      var b = o.querySelector('button');
      if (b) b.setAttribute('aria-expanded', 'false');
    });
  });
  d.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      d.querySelectorAll('.has-menu.open').forEach(function (o) { o.classList.remove('open'); });
      if (d.body.classList.contains('nav-open')) {
        d.body.classList.remove('nav-open');
        if (toggle) toggle.setAttribute('aria-expanded', 'false');
      }
    }
  });

  /* ---------- Scroll reveal ---------- */
  var reveals = d.querySelectorAll('.reveal');
  if (reveals.length && 'IntersectionObserver' in window &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    var ro = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); ro.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    reveals.forEach(function (el) { ro.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('in'); });
  }

  /* ---------- Hero parallax ---------- */
  var heroBg = d.querySelector('.hero .hero-bg');
  if (heroBg && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    var hero = heroBg.closest('.hero');
    var plxQueued = false;
    var applyPlx = function () {
      plxQueued = false;
      var rect = hero.getBoundingClientRect();
      if (rect.bottom < 0) return; // hero is off-screen
      var y = Math.max(0, -rect.top) * 0.35;
      heroBg.style.transform = 'translate3d(0,' + y.toFixed(1) + 'px,0)';
    };
    window.addEventListener('scroll', function () {
      if (!plxQueued) { plxQueued = true; requestAnimationFrame(applyPlx); }
    }, { passive: true });
    applyPlx();
  }

  /* ---------- Lazy YouTube (click-to-load facade) ---------- */
  d.querySelectorAll('.yt-lite').forEach(function (el) {
    var id = el.getAttribute('data-yt');
    if (!id) return;
    if (!el.style.backgroundImage) {
      el.style.backgroundImage =
        'url("https://i.ytimg.com/vi/' + id + '/hqdefault.jpg")';
      if (el.getAttribute('data-thumb') === 'maxres') {
        // large embeds: swap in the 1280px thumbnail if it exists
        // (YouTube serves a 120x90 placeholder when maxres is missing)
        var probe = new Image();
        probe.onload = function () {
          if (probe.naturalWidth > 300) {
            el.style.backgroundImage = 'url("' + probe.src + '")';
          }
        };
        probe.src = 'https://i.ytimg.com/vi/' + id + '/maxresdefault.jpg';
      }
    }
    el.addEventListener('click', function () {
      var iframe = d.createElement('iframe');
      iframe.src = 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&rel=0';
      iframe.title = el.getAttribute('data-title') || 'YouTube video';
      iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
      iframe.allowFullscreen = true;
      el.innerHTML = '';
      el.appendChild(iframe);
      el.classList.add('activated');
    }, { once: true });
  });

  /* ---------- Trailer modal ---------- */
  d.querySelectorAll('[data-modal-target]').forEach(function (opener) {
    opener.addEventListener('click', function (e) {
      e.preventDefault();
      var dlg = d.getElementById(opener.getAttribute('data-modal-target'));
      if (!dlg) return;
      dlg.showModal();
      var lite = dlg.querySelector('.yt-lite');
      if (lite && !lite.classList.contains('activated')) lite.click();
    });
  });
  function teardownModalVideo(dlg) {
    dlg.querySelectorAll('.yt-lite.activated').forEach(function (lite) {
      var id = lite.getAttribute('data-yt');
      lite.classList.remove('activated');
      lite.innerHTML = '<span class="play" aria-hidden="true"></span>';
      rearmLite(lite, id);
    });
  }
  d.querySelectorAll('dialog.modal').forEach(function (dlg) {
    var closeBtn = dlg.querySelector('.close');
    function shut() { teardownModalVideo(dlg); dlg.close(); }
    if (closeBtn) closeBtn.addEventListener('click', shut);
    dlg.addEventListener('click', function (e) { if (e.target === dlg) shut(); });
    dlg.addEventListener('cancel', function () { teardownModalVideo(dlg); }); // Esc key
    dlg.addEventListener('close', function () { teardownModalVideo(dlg); });  // any other path
  });
  function rearmLite(el, id) {
    el.addEventListener('click', function () {
      var iframe = d.createElement('iframe');
      iframe.src = 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&rel=0';
      iframe.title = el.getAttribute('data-title') || 'YouTube video';
      iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
      iframe.allowFullscreen = true;
      el.innerHTML = '';
      el.appendChild(iframe);
      el.classList.add('activated');
    }, { once: true });
  }

  /* ---------- Shows ---------- */
  var MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  var DOWS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  function parseLocalDate(iso) {
    var p = iso.split('-');
    return new Date(+p[0], +p[1] - 1, +p[2]);
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function gcalUrl(show) {
    var dt = parseLocalDate(show.date);
    function fmt(date, time) {
      var t = (time || '19:00').split(':');
      var e = new Date(date.getFullYear(), date.getMonth(), date.getDate(), +t[0], +t[1]);
      function pad(n) { return (n < 10 ? '0' : '') + n; }
      return '' + e.getFullYear() + pad(e.getMonth() + 1) + pad(e.getDate()) +
        'T' + pad(e.getHours()) + pad(e.getMinutes()) + '00';
    }
    var start = fmt(dt, show.startTime24);
    var endT = show.endTime24 || defaultEnd(show.startTime24);
    var end = fmt(dt, endT);
    var params = new URLSearchParams({
      action: 'TEMPLATE',
      text: 'Galen Marten Music at ' + show.venue,
      dates: start + '/' + end,
      location: show.address || (show.venue + ', ' + show.city),
      details: (show.note ? show.note + '\n\n' : '') + 'galenmartenmusic.com'
    });
    return 'https://calendar.google.com/calendar/render?' + params.toString();
  }
  function defaultEnd(start24) {
    if (!start24) return '22:00';
    var h = Math.min(23, +start24.split(':')[0] + 3);
    return (h < 10 ? '0' : '') + h + ':' + start24.split(':')[1];
  }

  function mapsUrl(show) {
    return 'https://www.google.com/maps/search/?api=1&query=' +
      encodeURIComponent(show.address || (show.venue + ' ' + show.city));
  }

  function fmtTime(t24) {
    if (!t24) return '';
    var p = t24.split(':');
    var h = +p[0], m = p[1];
    var ap = h >= 12 ? 'PM' : 'AM';
    h = h % 12; if (h === 0) h = 12;
    return h + (m === '00' ? '' : ':' + m) + ' ' + ap;
  }

  function gigHtml(show, opts) {
    var dt = parseLocalDate(show.date);
    var time = fmtTime(show.startTime24);
    var timeStr = time + (show.endTime24 ? '–' + fmtTime(show.endTime24) : '');
    var img = show.image
      ? '<div class="gig-art"><img src="' + esc(show.image) + '" alt="' + esc('Show art for ' + show.venue) + '" loading="lazy" width="800" height="533"></div>'
      : '';
    return '<li class="gig reveal">' +
      '<div class="gig-stub" aria-hidden="true">' +
        '<div class="dow">' + DOWS[dt.getDay()] + '</div>' +
        '<div class="day">' + dt.getDate() + '</div>' +
        '<div class="mon">' + MONTHS[dt.getMonth()].slice(0, 3) + '</div>' +
      '</div>' +
      img +
      '<div class="gig-info">' +
        '<p class="visually-hidden">' + esc(MONTHS[dt.getMonth()] + ' ' + dt.getDate() + ', ' + dt.getFullYear()) + '</p>' +
        '<h3 class="gig-venue">' + esc(show.venue) + '</h3>' +
        '<p class="gig-meta">' + esc(show.city) +
          (timeStr ? '<span class="sep">/</span>' + esc(timeStr) : '') + '</p>' +
        (show.note ? '<p class="gig-note">' + esc(show.note) + '</p>' : '') +
      '</div>' +
      '<div class="gig-actions">' +
        (show.rsvpUrl ? '<a class="btn btn-dark" href="' + esc(show.rsvpUrl) + '" target="_blank" rel="noopener">RSVP</a>' : '') +
        '<a class="btn btn-dark" href="' + gcalUrl(show) + '" target="_blank" rel="noopener">Add to calendar</a>' +
        '<a class="btn btn-quiet" href="' + mapsUrl(show) + '" target="_blank" rel="noopener">Directions</a>' +
      '</div>' +
    '</li>';
  }

  function renderShows() {
    var homeList = d.getElementById('gig-list-home');
    var fullList = d.getElementById('gig-list-full');
    if (!homeList && !fullList) return;

    fetch('/data/shows.json')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        var today = new Date();
        today.setHours(0, 0, 0, 0);
        var upcoming = data.shows
          .filter(function (s) { return parseLocalDate(s.date) >= today; })
          .sort(function (a, b) { return a.date < b.date ? -1 : 1; });

        if (homeList) {
          var next = upcoming.slice(0, 4);
          homeList.innerHTML = next.length
            ? next.map(function (s) { return gigHtml(s, {}); }).join('')
            : '<li class="gig-empty">New dates are in the works — check back soon or join the email list below.</li>';
        }

        if (fullList) {
          if (!upcoming.length) {
            fullList.innerHTML = '<li class="gig-empty">New dates are in the works — check back soon or join the email list below.</li>';
          } else {
            var html = '';
            var lastMonth = '';
            upcoming.forEach(function (s) {
              var dt = parseLocalDate(s.date);
              var key = MONTHS[dt.getMonth()] + ' ' + dt.getFullYear();
              if (key !== lastMonth) {
                html += '<li class="gig-month" aria-hidden="true">' + key + '</li>';
                lastMonth = key;
              }
              html += gigHtml(s, {});
            });
            fullList.innerHTML = html;
          }
        }

        // re-observe new reveal nodes
        d.querySelectorAll('.gig.reveal:not(.in)').forEach(function (el) {
          el.classList.add('in');
        });
      })
      .catch(function () {
        var msg = '<li class="gig-empty">Shows couldn’t load. <a href="/shows/">Try the shows page</a> or check back shortly.</li>';
        if (homeList) homeList.innerHTML = msg;
        if (fullList) fullList.innerHTML = msg;
      });
  }
  renderShows();

  /* ---------- Product gallery ---------- */
  var gal = d.querySelector('.product-gallery');
  if (gal) {
    var mainImg = gal.querySelector('.main img');
    gal.querySelectorAll('.thumbs button').forEach(function (b) {
      b.addEventListener('click', function () {
        mainImg.src = b.getAttribute('data-src');
        gal.querySelectorAll('.thumbs button').forEach(function (x) { x.setAttribute('aria-current', 'false'); });
        b.setAttribute('aria-current', 'true');
      });
    });
  }

  /* ---------- Spotify album embeds (click-to-load) ---------- */
  d.querySelectorAll('.album-embed .placeholder').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var id = btn.getAttribute('data-spotify');
      var iframe = d.createElement('iframe');
      iframe.src = 'https://open.spotify.com/embed/album/' + id + '?utm_source=generator&theme=0';
      iframe.title = btn.getAttribute('data-title') || 'Spotify player';
      iframe.loading = 'lazy';
      iframe.allow = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
      btn.replaceWith(iframe);
    }, { once: true });
  });

  /* ---------- Forms (Netlify) ---------- */
  d.querySelectorAll('form[data-ajax]').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = form.querySelector('[type="submit"]');
      var orig = btn ? btn.textContent : '';
      if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }
      var body = new URLSearchParams(new FormData(form)).toString();
      fetch('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body
      }).then(function (r) {
        if (!r.ok) throw new Error('bad status');
        var ok = d.createElement('div');
        ok.className = 'form-success';
        ok.setAttribute('role', 'status');
        ok.textContent = form.getAttribute('data-success') || 'Thanks — message sent. Galen will get back to you soon.';
        form.replaceWith(ok);
      }).catch(function () {
        if (btn) { btn.disabled = false; btn.textContent = orig; }
        var err = form.querySelector('.form-error');
        if (!err) {
          err = d.createElement('p');
          err.className = 'form-error form-note';
          err.setAttribute('role', 'alert');
          form.appendChild(err);
        }
        err.textContent = 'Something went wrong sending this. Please try again, or email gsmarten@gmail.com directly.';
      });
    });
  });

  /* ---------- Footer year ---------- */
  var yr = d.getElementById('year');
  if (yr) yr.textContent = String(new Date().getFullYear());
})();
