/* SF Croissant Index — a blind-tasting scorecard for the group chat.
   No build step, no backend: state lives in localStorage. */
(function () {
  'use strict';

  var STORAGE_KEY = 'sf-croissant-index/v1';
  var TASTER_KEY = 'sf-croissant-index/taster';

  var CRITERIA = [
    { key: 'lamination', label: 'Lamination', hint: 'Distinct layers, open honeycomb' },
    { key: 'crust', label: 'Crust', hint: 'Shatter, crackle, shard count' },
    { key: 'crumb', label: 'Crumb', hint: 'Chewy and cooked through, never doughy' },
    { key: 'butter', label: 'Butter', hint: 'Depth of flavor, cultured tang' },
    { key: 'balance', label: 'Balance', hint: 'Bake, salt, size, finish' }
  ];
  var MAX_POINTS = CRITERIA.length * 10; // 50 → doubled for a score out of 100

  // Starting lineup only — no scores are seeded. Add, rate and edit as you go.
  var SEED_BAKERIES = [
    { name: 'Arsicault Bakery', hood: 'Inner Richmond' },
    { name: 'b. Patisserie', hood: 'Lower Pacific Heights' },
    { name: 'Tartine Bakery', hood: 'Mission' },
    { name: 'Neighbor Bakehouse', hood: 'Dogpatch' },
    { name: 'Jane the Bakery', hood: 'Fillmore' },
    { name: 'Le Marais Bakery', hood: 'Castro' },
    { name: 'ONE65', hood: 'Union Square' },
    { name: 'Juniper', hood: '' },
    { name: 'Andytown Coffee Roasters', hood: 'Outer Sunset' },
    { name: 'Vive La Tarte', hood: 'SoMa' }
  ];

  var $ = function (sel) { return document.querySelector(sel); };
  var state = { bakeries: [], tastings: [] };
  var openCards = {};

  /* ---------------------------------------------------------------- storage */

  function uid() {
    return Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
  }

  function load() {
    var raw = null;
    try { raw = localStorage.getItem(STORAGE_KEY); } catch (e) { raw = null; }
    if (raw) {
      try {
        var parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.bakeries) && Array.isArray(parsed.tastings)) {
          state = { bakeries: parsed.bakeries, tastings: parsed.tastings };
          return;
        }
      } catch (e) { /* fall through to seed */ }
    }
    state = {
      bakeries: SEED_BAKERIES.map(function (b) {
        return { id: uid(), name: b.name, hood: b.hood };
      }),
      tastings: []
    };
    save();
  }

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* private mode */ }
  }

  /* ------------------------------------------------------------------ stats */

  function scoreOf(t) {
    var sum = 0;
    for (var i = 0; i < CRITERIA.length; i++) sum += Number(t.scores[CRITERIA[i].key]) || 0;
    return Math.round((sum / MAX_POINTS) * 100);
  }

  function mean(nums) {
    if (!nums.length) return 0;
    var s = 0;
    for (var i = 0; i < nums.length; i++) s += nums[i];
    return s / nums.length;
  }

  function activeTastings() {
    var taster = $('#filter-taster').value;
    if (!taster) return state.tastings;
    return state.tastings.filter(function (t) { return t.taster === taster; });
  }

  // One row per bakery that has at least one tasting in `tastings`.
  function summarize(tastings) {
    var byBakery = {};
    tastings.forEach(function (t) {
      (byBakery[t.bakeryId] = byBakery[t.bakeryId] || []).push(t);
    });
    return state.bakeries.filter(function (b) { return byBakery[b.id]; }).map(function (b) {
      var rows = byBakery[b.id].slice().sort(function (a, c) { return c.date.localeCompare(a.date); });
      var dims = {};
      CRITERIA.forEach(function (c) {
        dims[c.key] = mean(rows.map(function (t) { return Number(t.scores[c.key]) || 0; }));
      });
      var prices = rows.map(function (t) { return Number(t.price); }).filter(function (p) { return p > 0; });
      var price = prices.length ? mean(prices) : 0;
      var score = mean(rows.map(scoreOf));
      return {
        bakery: b,
        rows: rows,
        count: rows.length,
        score: score,
        price: price,
        value: price ? score / price : 0,
        dims: dims,
        tasters: rows.map(function (t) { return t.taster; }).filter(function (v, i, a) { return a.indexOf(v) === i; })
      };
    });
  }

  function sortSummaries(list, mode) {
    var by = {
      score: function (a, b) { return b.score - a.score || b.count - a.count; },
      value: function (a, b) { return b.value - a.value; },
      price: function (a, b) { return (a.price || Infinity) - (b.price || Infinity); },
      count: function (a, b) { return b.count - a.count || b.score - a.score; }
    };
    return list.slice().sort(by[mode] || by.score);
  }

  var money = function (n) { return '$' + n.toFixed(2); };
  var oneDp = function (n) { return (Math.round(n * 10) / 10).toFixed(1); };

  function bakeryById(id) {
    for (var i = 0; i < state.bakeries.length; i++) if (state.bakeries[i].id === id) return state.bakeries[i];
    return null;
  }

  /* --------------------------------------------------------------- rankings */

  function renderSummaryStats(summaries) {
    var all = activeTastings();
    var best = summaries.length ? sortSummaries(summaries, 'score')[0] : null;
    var prices = all.map(function (t) { return Number(t.price); }).filter(function (p) { return p > 0; });
    var tiles = [
      { value: String(all.length), label: all.length === 1 ? 'tasting logged' : 'tastings logged' },
      { value: prices.length ? money(mean(prices)) : '—', label: 'average price' },
      { value: best ? best.bakery.name : '—', label: best ? 'leader · ' + Math.round(best.score) + '/100' : 'no leader yet', name: true }
    ];
    $('#summary-stats').innerHTML = tiles.map(function (t) {
      return '<div class="stat' + (t.name ? ' name' : '') + '"><span class="stat-value">' + esc(t.value) + '</span>' +
             '<span class="stat-label">' + esc(t.label) + '</span></div>';
    }).join('');
  }

  function renderRankings() {
    var summaries = summarize(activeTastings());
    renderSummaryStats(summaries);

    var sorted = sortSummaries(summaries, $('#sort-by').value);
    var list = $('#ranking-list');
    $('#ranking-empty').hidden = sorted.length > 0;
    list.innerHTML = sorted.map(function (s, i) {
      var open = !!openCards[s.bakery.id];
      var meta = [
        s.bakery.hood || null,
        s.price ? money(s.price) : 'price unknown',
        s.count + (s.count === 1 ? ' tasting' : ' tastings'),
        s.value ? oneDp(s.value) + ' pts/$' : null
      ].filter(Boolean).join(' · ');

      return '<li class="card">' +
        '<button class="card-head" type="button" data-toggle="' + s.bakery.id + '" aria-expanded="' + open + '">' +
          '<span class="rank-num">' + (i + 1) + '</span>' +
          '<span><h3 class="card-name">' + esc(s.bakery.name) + '</h3><p class="card-meta">' + esc(meta) + '</p></span>' +
          '<span class="card-score">' + Math.round(s.score) + '<small>/100</small></span>' +
        '</button>' +
        (open ? '<div class="card-body">' + cardBody(s) + '</div>' : '') +
      '</li>';
    }).join('');

    var tastedIds = summaries.map(function (s) { return s.bakery.id; });
    var untasted = state.bakeries.filter(function (b) { return tastedIds.indexOf(b.id) === -1; });
    $('#untasted-list').innerHTML = untasted.length
      ? untasted.map(function (b) {
          return '<li><button class="chip" type="button" data-rate="' + b.id + '">' + esc(b.name) + '</button></li>';
        }).join('')
      : '<li class="card-meta">Every bakery on the list has been tasted. Add another one.</li>';
  }

  function cardBody(s) {
    var dims = '<div class="dims">' + CRITERIA.map(function (c) {
      var v = s.dims[c.key];
      return '<div class="dim"><span>' + esc(c.label) + '</span>' +
        '<span class="dim-track"><span class="dim-fill" style="width:' + (v * 10) + '%"></span></span>' +
        '<span class="dim-val">' + oneDp(v) + '</span></div>';
    }).join('') + '</div>';

    var rows = '<ul class="tastings">' + s.rows.map(function (t) {
      return '<li class="tasting"><b>' + esc(t.taster) + '</b> · ' + esc(t.date) +
        ' · ' + (Number(t.price) ? money(Number(t.price)) : 'no price') +
        ' · <b>' + scoreOf(t) + '/100</b>' +
        (t.notes ? '<p class="tasting-note">“' + esc(t.notes) + '”</p>' : '') + '</li>';
    }).join('') + '</ul>';

    return dims + rows;
  }

  /* ------------------------------------------------------------------ chart */

  var PAD = { top: 18, right: 20, bottom: 42, left: 52 };
  var W = 640, H = 400;

  // Pads the data range, then snaps it out to round 1/2/2.5/5 × 10^k steps so
  // the axis reads $4, $5, $6 rather than $4.31, $5.38, $6.44.
  function niceScale(values, pad, lo, hi, count) {
    var min = Math.min.apply(null, values) - pad;
    var max = Math.max.apply(null, values) + pad;
    if (max - min < 1e-9) { min -= pad || 1; max += pad || 1; }
    var raw = (max - min) / count;
    var mag = Math.pow(10, Math.floor(Math.log10(raw)));
    var norm = raw / mag;
    var step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
    var start = Math.max(lo, Math.floor(min / step) * step);
    var end = Math.min(hi, Math.ceil(max / step) * step);
    var out = [];
    for (var v = Math.ceil(start / step) * step; v <= end + step * 1e-6; v += step) {
      out.push(Math.round(v * 1e6) / 1e6);
    }
    return { domain: [start, end], ticks: out, step: step };
  }

  function renderChart() {
    var points = summarize(activeTastings()).filter(function (s) { return s.price > 0; });
    var svg = $('#scatter');
    $('#chart-empty').hidden = points.length > 0;
    svg.style.display = points.length ? '' : 'none';

    renderChartTable(points);
    if (!points.length) { svg.innerHTML = ''; return; }

    var xs = niceScale(points.map(function (p) { return p.score; }), 6, 0, 100, 5);
    var ys = niceScale(points.map(function (p) { return p.price; }), 0.75, 0, 1e4, 5);
    var xDomain = xs.domain, yDomain = ys.domain;
    var x = function (v) { return PAD.left + (v - xDomain[0]) / (xDomain[1] - xDomain[0]) * (W - PAD.left - PAD.right); };
    var y = function (v) { return H - PAD.bottom - (v - yDomain[0]) / (yDomain[1] - yDomain[0]) * (H - PAD.top - PAD.bottom); };
    var priceTick = function (v) { return '$' + v.toFixed(ys.step < 1 ? 2 : 0); };
    var maxCount = Math.max.apply(null, points.map(function (p) { return p.count; }));
    var r = function (n) { return maxCount > 1 ? 7 + 6 * Math.sqrt((n - 1) / (maxCount - 1)) : 8; };

    var parts = ['<title id="scatter-title">Average price plotted against average combined score for each bakery</title>'];

    ys.ticks.forEach(function (v) {
      parts.push('<line x1="' + PAD.left + '" x2="' + (W - PAD.right) + '" y1="' + y(v).toFixed(1) +
        '" y2="' + y(v).toFixed(1) + '" stroke="var(--grid)" stroke-width="1"/>');
      parts.push('<text x="' + (PAD.left - 10) + '" y="' + (y(v) + 4).toFixed(1) +
        '" text-anchor="end" fill="var(--muted)" font-size="12">' + priceTick(v) + '</text>');
    });
    xs.ticks.forEach(function (v) {
      parts.push('<text x="' + x(v).toFixed(1) + '" y="' + (H - PAD.bottom + 20) +
        '" text-anchor="middle" fill="var(--muted)" font-size="12">' + Math.round(v) + '</text>');
    });
    parts.push('<line x1="' + PAD.left + '" x2="' + (W - PAD.right) + '" y1="' + (H - PAD.bottom) +
      '" y2="' + (H - PAD.bottom) + '" stroke="var(--axis)" stroke-width="1"/>');
    parts.push('<text x="' + (W - PAD.right) + '" y="' + (H - 8) +
      '" text-anchor="end" fill="var(--muted)" font-size="12">Combined score →</text>');
    parts.push('<text x="' + PAD.left + '" y="' + (PAD.top - 4) +
      '" text-anchor="start" fill="var(--muted)" font-size="12">Price</text>');

    // Label the leaders; everything else is available on hover and in the table.
    var labelled = points.slice().sort(function (a, b) { return b.score - a.score; }).slice(0, 3)
      .map(function (p) { return p.bakery.id; });

    points.forEach(function (p, i) {
      var cx = x(p.score), cy = y(p.price), rad = r(p.count);
      parts.push('<circle class="pt" data-i="' + i + '" cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) +
        '" r="' + rad.toFixed(1) + '" fill="var(--series-1)" stroke="var(--surface-1)" stroke-width="2"/>');
      if (labelled.indexOf(p.bakery.id) !== -1) {
        var right = cx < W - PAD.right - 110;
        parts.push('<text x="' + (cx + (right ? rad + 6 : -rad - 6)).toFixed(1) + '" y="' + (cy + 4).toFixed(1) +
          '" text-anchor="' + (right ? 'start' : 'end') + '" fill="var(--text-secondary)" font-size="12.5">' +
          esc(p.bakery.name) + '</text>');
      }
    });

    svg.innerHTML = parts.join('');
    attachChartHover(points);
  }

  function attachChartHover(points) {
    var tip = $('#chart-tooltip');
    var wrap = $('#chart-wrap');
    var circles = $('#scatter').querySelectorAll('.pt');

    function show(e) {
      var p = points[Number(this.getAttribute('data-i'))];
      var box = wrap.getBoundingClientRect();
      var mark = this.getBoundingClientRect();
      tip.innerHTML = '<b>' + esc(p.bakery.name) + '</b>' + Math.round(p.score) + '/100 · ' + money(p.price) +
        ' · ' + oneDp(p.value) + ' pts/$<br>' + p.count + (p.count === 1 ? ' tasting' : ' tastings');
      tip.hidden = false;
      // Keep the bubble inside the chart card, and flip it below the mark near the top.
      var half = tip.offsetWidth / 2;
      var cx = mark.left + mark.width / 2 - box.left;
      tip.style.left = Math.max(half + 4, Math.min(box.width - half - 4, cx)) + 'px';
      var above = mark.top - box.top - 8;
      var below = above > tip.offsetHeight + 8;
      tip.style.top = (below ? above : mark.bottom - box.top + 8 + tip.offsetHeight) + 'px';
      this.setAttribute('stroke-width', '3');
    }
    function hide() { tip.hidden = true; this.setAttribute('stroke-width', '2'); }

    for (var i = 0; i < circles.length; i++) {
      circles[i].addEventListener('mouseenter', show);
      circles[i].addEventListener('mouseleave', hide);
      circles[i].addEventListener('focus', show);
      circles[i].addEventListener('blur', hide);
      circles[i].setAttribute('tabindex', '0');
    }
  }

  function renderChartTable(points) {
    var body = $('#chart-table').querySelector('tbody');
    var sorted = sortSummaries(points, 'score');
    body.innerHTML = sorted.map(function (p) {
      return '<tr><td>' + esc(p.bakery.name) + '</td><td>' + Math.round(p.score) + '</td><td>' +
        money(p.price) + '</td><td>' + oneDp(p.value) + '</td><td>' + p.count + '</td></tr>';
    }).join('');
  }

  /* ------------------------------------------------------------------- form */

  function renderSliders() {
    $('#sliders').innerHTML = CRITERIA.map(function (c) {
      return '<div class="slider">' +
        '<label class="slider-label" for="s-' + c.key + '">' + esc(c.label) +
          '<span class="slider-hint">' + esc(c.hint) + '</span></label>' +
        '<output class="slider-val" id="out-' + c.key + '">6</output>' +
        '<input type="range" id="s-' + c.key + '" min="1" max="10" step="1" value="6" data-key="' + c.key + '">' +
      '</div>';
    }).join('');
    $('#sliders').addEventListener('input', function (e) {
      var key = e.target.getAttribute('data-key');
      if (!key) return;
      $('#out-' + key).textContent = e.target.value;
      updateLiveScore();
    });
  }

  function currentScores() {
    var scores = {};
    CRITERIA.forEach(function (c) { scores[c.key] = Number($('#s-' + c.key).value); });
    return scores;
  }

  function updateLiveScore() {
    $('#live-score').textContent = scoreOf({ scores: currentScores() });
  }

  function renderBakeryOptions() {
    var select = $('#bakery-select');
    var current = select.value;
    var names = state.bakeries.slice().sort(function (a, b) { return a.name.localeCompare(b.name); });
    select.innerHTML = '<option value="">Choose a bakery…</option>' +
      names.map(function (b) { return '<option value="' + b.id + '">' + esc(b.name) + '</option>'; }).join('') +
      '<option value="__new">＋ Add a new bakery</option>';
    select.value = current && select.querySelector('option[value="' + current + '"]') ? current : '';
  }

  function renderTasterOptions() {
    var select = $('#filter-taster');
    var current = select.value;
    var tasters = state.tastings.map(function (t) { return t.taster; })
      .filter(function (v, i, a) { return v && a.indexOf(v) === i; }).sort();
    select.innerHTML = '<option value="">Everyone</option>' +
      tasters.map(function (t) { return '<option value="' + esc(t) + '">' + esc(t) + '</option>'; }).join('');
    select.value = tasters.indexOf(current) !== -1 ? current : '';
  }

  // Re-applies the defaults a native form reset can't know about. Never calls
  // form.reset() itself — the reset listener calls this, and that would recurse.
  function setFormDefaults() {
    CRITERIA.forEach(function (c) { $('#s-' + c.key).value = 6; $('#out-' + c.key).textContent = '6'; });
    updateLiveScore();
    $('#date').value = todayISO();
    try { $('#taster').value = localStorage.getItem(TASTER_KEY) || ''; } catch (e) { /* ignore */ }
    $('#new-bakery-fields').hidden = true;
    renderBakeryOptions();
  }

  function todayISO() {
    var d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }

  function submitTasting(e) {
    e.preventDefault();
    var msg = $('#form-msg');
    var choice = $('#bakery-select').value;
    var taster = $('#taster').value.trim();
    var price = Number($('#price').value);
    var date = $('#date').value || todayISO();

    function fail(text) { msg.textContent = text; msg.classList.add('error'); }

    if (!choice) return fail('Pick a bakery first.');
    if (!taster) return fail('Add a taster name so the group knows whose palate this is.');
    if (!(price > 0)) return fail('Enter what you paid — the price/score chart needs it.');

    var bakeryId;
    if (choice === '__new') {
      var name = $('#new-bakery-name').value.trim();
      if (!name) return fail('Name the new bakery.');
      var existing = state.bakeries.filter(function (b) {
        return b.name.toLowerCase() === name.toLowerCase();
      })[0];
      if (existing) {
        bakeryId = existing.id;
      } else {
        var bakery = { id: uid(), name: name, hood: $('#new-bakery-hood').value.trim() };
        state.bakeries.push(bakery);
        bakeryId = bakery.id;
      }
    } else {
      bakeryId = choice;
    }

    state.tastings.push({
      id: uid(),
      bakeryId: bakeryId,
      taster: taster,
      date: date,
      price: price,
      scores: currentScores(),
      notes: $('#notes').value.trim()
    });
    save();
    try { localStorage.setItem(TASTER_KEY, taster); } catch (err) { /* ignore */ }

    msg.classList.remove('error');
    msg.textContent = 'Saved — ' + bakeryById(bakeryId).name + ' scored ' +
      scoreOf(state.tastings[state.tastings.length - 1]) + '/100.';
    openCards[bakeryId] = true;
    var saved = msg.textContent;
    $('#tasting-form').reset();   // fires the reset listener, which re-applies defaults
    msg.textContent = saved;
    renderAll();
  }

  /* ------------------------------------------------------------------- data */

  function renderTastingsTable() {
    var body = $('#tastings-table').querySelector('tbody');
    var rows = state.tastings.slice().sort(function (a, b) {
      return b.date.localeCompare(a.date) || b.id.localeCompare(a.id);
    });
    $('#tastings-empty').hidden = rows.length > 0;
    $('#tastings-table').hidden = rows.length === 0;
    body.innerHTML = rows.map(function (t) {
      var b = bakeryById(t.bakeryId);
      return '<tr><td>' + esc(t.date) + '</td><td>' + esc(b ? b.name : 'Unknown') + '</td><td>' +
        esc(t.taster) + '</td><td>' + (Number(t.price) ? money(Number(t.price)) : '—') + '</td><td>' +
        scoreOf(t) + '</td><td><button class="link-btn" type="button" data-delete="' + t.id + '">Delete</button></td></tr>';
    }).join('');
  }

  function summaryText() {
    var summaries = sortSummaries(summarize(state.tastings), 'score');
    if (!summaries.length) return 'SF Croissant Index — nothing logged yet.';
    var lines = summaries.map(function (s, i) {
      return (i + 1) + '. ' + s.bakery.name + ' — ' + Math.round(s.score) + '/100' +
        (s.price ? ' (' + money(s.price) + ', ' + oneDp(s.value) + ' pts/$)' : '');
    });
    var best = summaries.slice().sort(function (a, b) { return b.value - a.value; })[0];
    lines.push('Best value: ' + best.bakery.name + ' at ' + oneDp(best.value) + ' pts/$');
    return '🥐 SF Croissant Index\n' + lines.join('\n');
  }

  function download(filename, text) {
    var blob = new Blob([text], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function importFile(file) {
    var msg = $('#data-msg');
    var reader = new FileReader();
    reader.onload = function () {
      var incoming;
      try { incoming = JSON.parse(String(reader.result)); } catch (e) { incoming = null; }
      if (!incoming || !Array.isArray(incoming.bakeries) || !Array.isArray(incoming.tastings)) {
        msg.classList.add('error');
        msg.textContent = "That file doesn't look like a croissant export.";
        return;
      }
      // Merge: bakeries match on name, tastings on id, so re-importing is safe.
      var idMap = {}, addedBakeries = 0, addedTastings = 0;
      incoming.bakeries.forEach(function (b) {
        var match = state.bakeries.filter(function (x) {
          return x.name.toLowerCase() === String(b.name).toLowerCase();
        })[0];
        if (match) {
          idMap[b.id] = match.id;
        } else {
          var created = { id: uid(), name: String(b.name), hood: String(b.hood || '') };
          state.bakeries.push(created);
          idMap[b.id] = created.id;
          addedBakeries++;
        }
      });
      var seen = {};
      state.tastings.forEach(function (t) { seen[t.id] = true; });
      incoming.tastings.forEach(function (t) {
        if (seen[t.id] || !idMap[t.bakeryId] || !t.scores) return;
        state.tastings.push({
          id: t.id || uid(),
          bakeryId: idMap[t.bakeryId],
          taster: String(t.taster || 'Anonymous'),
          date: String(t.date || todayISO()).slice(0, 10),
          price: Number(t.price) || 0,
          scores: t.scores,
          notes: String(t.notes || '')
        });
        addedTastings++;
      });
      save();
      msg.classList.remove('error');
      msg.textContent = 'Merged ' + addedTastings + ' tasting' + (addedTastings === 1 ? '' : 's') +
        ' and ' + addedBakeries + ' new baker' + (addedBakeries === 1 ? 'y' : 'ies') + '.';
      renderAll();
    };
    reader.readAsText(file);
  }

  /* ------------------------------------------------------------------- wire */

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function selectTab(id) {
    ['rankings', 'log', 'chart', 'data'].forEach(function (name) {
      var on = name === id;
      $('#tab-' + name).setAttribute('aria-selected', String(on));
      $('#panel-' + name).hidden = !on;
    });
    if (id === 'chart') renderChart();
  }

  function renderAll() {
    renderTasterOptions();
    renderRankings();
    renderBakeryOptions();
    renderTastingsTable();
    if (!$('#panel-chart').hidden) renderChart();
  }

  function applyStoredTheme() {
    var stored = null;
    try { stored = localStorage.getItem('sf-croissant-index/theme'); } catch (e) { /* ignore */ }
    if (stored) document.documentElement.setAttribute('data-theme', stored);
  }

  function init() {
    applyStoredTheme();
    load();
    renderSliders();
    setFormDefaults();
    renderAll();

    ['rankings', 'log', 'chart', 'data'].forEach(function (name) {
      $('#tab-' + name).addEventListener('click', function () { selectTab(name); });
    });

    $('#sort-by').addEventListener('change', renderRankings);
    $('#filter-taster').addEventListener('change', function () {
      renderRankings();
      if (!$('#panel-chart').hidden) renderChart();
    });

    $('#ranking-list').addEventListener('click', function (e) {
      var head = e.target.closest('[data-toggle]');
      if (!head) return;
      var id = head.getAttribute('data-toggle');
      openCards[id] = !openCards[id];
      renderRankings();
    });

    $('#untasted-list').addEventListener('click', function (e) {
      var chip = e.target.closest('[data-rate]');
      if (!chip) return;
      selectTab('log');
      $('#bakery-select').value = chip.getAttribute('data-rate');
      $('#new-bakery-fields').hidden = true;
      $('#price').focus();
    });

    $('#bakery-select').addEventListener('change', function () {
      $('#new-bakery-fields').hidden = this.value !== '__new';
      if (this.value === '__new') $('#new-bakery-name').focus();
    });

    $('#tasting-form').addEventListener('submit', submitTasting);
    $('#tasting-form').addEventListener('reset', function () {
      $('#form-msg').textContent = '';
      setTimeout(setFormDefaults, 0);
    });

    $('#tastings-table').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-delete]');
      if (!btn) return;
      var id = btn.getAttribute('data-delete');
      state.tastings = state.tastings.filter(function (t) { return t.id !== id; });
      save();
      renderAll();
    });

    $('#export-json').addEventListener('click', function () {
      download('sf-croissant-index-' + todayISO() + '.json', JSON.stringify(state, null, 2));
    });

    $('#import-json').addEventListener('change', function () {
      if (this.files && this.files[0]) importFile(this.files[0]);
      this.value = '';
    });

    $('#copy-summary').addEventListener('click', function () {
      var text = summaryText();
      var msg = $('#data-msg');
      msg.classList.remove('error');
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function () {
          msg.textContent = 'Rankings copied. Go win the argument.';
        }, function () { msg.textContent = text; });
      } else {
        msg.textContent = text;
      }
    });

    $('#reset-all').addEventListener('click', function () {
      if (!window.confirm('Delete every tasting and restore the starting bakery list?')) return;
      try { localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
      load();
      openCards = {};
      renderAll();
      $('#data-msg').classList.remove('error');
      $('#data-msg').textContent = 'Back to a blank scorecard.';
    });

    $('#theme-toggle').addEventListener('click', function () {
      var dark = document.documentElement.getAttribute('data-theme') === 'dark' ||
        (!document.documentElement.hasAttribute('data-theme') &&
          window.matchMedia('(prefers-color-scheme: dark)').matches);
      var next = dark ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem('sf-croissant-index/theme', next); } catch (e) { /* ignore */ }
      if (!$('#panel-chart').hidden) renderChart();
    });

    window.addEventListener('resize', function () {
      if (!$('#panel-chart').hidden) $('#chart-tooltip').hidden = true;
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
