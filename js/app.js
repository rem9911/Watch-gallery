(function () {
  'use strict';

  var STORAGE_KEY = 'watch-gallery:watches';
  var PREFS_KEY = 'watch-gallery:prefs';

  var SPEC_FIELDS = [
    { key: 'reference', label: 'Référence' },
    { key: 'diameter', label: 'Diamètre', unit: 'mm', numeric: true },
    { key: 'thickness', label: 'Épaisseur', unit: 'mm', numeric: true },
    { key: 'lugToLug', label: 'Corne à corne', unit: 'mm', numeric: true },
    { key: 'movement', label: 'Mouvement', placeholder: 'Automatique, quartz…' },
    { key: 'powerReserve', label: 'Réserve de marche', unit: 'h', numeric: true },
    { key: 'caseMaterial', label: 'Boîtier', placeholder: 'Acier, titane…' },
    { key: 'dial', label: 'Cadran', placeholder: 'Bleu soleillé…' },
    { key: 'waterResistance', label: 'Étanchéité', unit: 'm', numeric: true },
    { key: 'strap', label: 'Bracelet', placeholder: 'Acier, cuir…' }
  ];

  var VERDICTS = {
    none: { label: 'Sans avis', short: '—' },
    love: { label: 'Coup de cœur', short: '♥' },
    maybe: { label: 'À réfléchir', short: '?' },
    no: { label: 'Écartée', short: '✕' }
  };

  var FILTERS = [
    { id: 'all', label: 'Toutes', test: function () { return true; } },
    { id: 'todo', label: 'À essayer', test: function (w) { return !w.tried && w.verdict !== 'no'; } },
    { id: 'tried', label: 'Essayées', test: function (w) { return w.tried; } },
    { id: 'love', label: 'Coups de cœur', test: function (w) { return w.verdict === 'love'; } },
    { id: 'no', label: 'Écartées', test: function (w) { return w.verdict === 'no'; } }
  ];

  var SORTS = {
    'recent': function (a, b) { return b.createdAt - a.createdAt; },
    'price-asc': function (a, b) { return byPrice(a, b, 1); },
    'price-desc': function (a, b) { return byPrice(a, b, -1); },
    'rating': function (a, b) { return b.rating - a.rating || b.createdAt - a.createdAt; },
    'brand': function (a, b) {
      return (a.brand || '~').localeCompare(b.brand || '~', 'fr') || (a.model || '').localeCompare(b.model || '', 'fr');
    }
  };

  var KNOWN_BRANDS = [
    'A. Lange & Söhne', 'Alpina', 'Audemars Piguet', 'Ball', 'Baltic', 'Baume & Mercier', 'Bell & Ross',
    'Blancpain', 'Breguet', 'Breitling', 'Bulgari', 'Bulova', 'Cartier', 'Casio', 'Certina', 'Chopard',
    'Christopher Ward', 'Citizen', 'Credor', 'Czapek', 'Doxa', 'Edox', 'Farer', 'Formex', 'Fortis',
    'Frederique Constant', 'Furlan Marri', 'G-Shock', 'Girard-Perregaux', 'Glashütte Original', 'Grand Seiko',
    'H. Moser & Cie', 'Hamilton', 'Hermès', 'Hublot', 'IWC', 'Jaeger-LeCoultre', 'Junghans', 'King Seiko',
    'Kurono', 'Laco', 'Lip', 'Longines', 'Maurice Lacroix', 'Mido', 'Minase', 'Montblanc', 'Mühle-Glashütte',
    'Nomos', 'Omega', 'Orient', 'Oris', 'Panerai', 'Patek Philippe', 'Piaget', 'Rado', 'Raymond Weil',
    'Richard Mille', 'Rolex', 'Seiko', 'Serica', 'Sinn', 'Squale', 'Stowa', 'Swatch', 'TAG Heuer', 'Tissot',
    'Tudor', 'Ulysse Nardin', 'Unimatic', 'Vacheron Constantin', 'Victorinox', 'Yema', 'Zenith', 'Zodiac'
  ];

  var PLACEHOLDER_SVG =
    '<svg viewBox="0 0 64 64" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">' +
    '<path d="M24 12 26 4h12l2 8M24 52l2 8h12l2-8"/><circle cx="32" cy="32" r="18"/>' +
    '<path d="M32 21v11l7 5M50 30h3v4h-3"/></svg>';

  var state = {
    watches: [],
    view: 'gallery',
    filter: 'all',
    sort: 'recent',
    query: '',
    editing: null,
    quickAdd: null,
    lastDeleted: null
  };

  // ---------------------------------------------------------------------------
  // Utilitaires
  // ---------------------------------------------------------------------------

  function $(sel, root) { return (root || document).querySelector(sel); }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'class') node.className = v;
      else if (k === 'dataset') Object.assign(node.dataset, v);
      else if (k.indexOf('on') === 0) node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v === true ? '' : v);
    });
    for (var i = 2; i < arguments.length; i++) append(node, arguments[i]);
    return node;
  }

  function append(node, child) {
    if (child == null || child === false) return;
    if (Array.isArray(child)) child.forEach(function (c) { append(node, c); });
    else node.append(child instanceof Node ? child : String(child));
  }

  function svg(markup) {
    var span = document.createElement('span');
    span.className = 'placeholder';
    span.innerHTML = markup;
    return span;
  }

  function uid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  }

  function today() {
    var d = new Date();
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }

  function clean(s) {
    return s == null ? '' : String(s).replace(/\s+/g, ' ').trim();
  }

  function fold(s) {
    return clean(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }

  function safeUrl(u) {
    try {
      var url = new URL(clean(u));
      return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '';
    } catch (e) {
      return '';
    }
  }

  function urlKey(u) {
    try {
      var url = new URL(u);
      url.hash = '';
      Array.from(url.searchParams.keys()).forEach(function (k) {
        if (/^(utm_|gclid|fbclid|msclkid|mc_|ref$)/i.test(k)) url.searchParams.delete(k);
      });
      return (url.host.replace(/^www\./, '') + url.pathname.replace(/\/+$/, '') + url.search).toLowerCase();
    } catch (e) {
      return clean(u).toLowerCase();
    }
  }

  function hostOf(u) {
    try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; }
  }

  function num(v) {
    var n = parseFloat(String(v == null ? '' : v).replace(',', '.'));
    return isFinite(n) ? n : null;
  }

  function parsePrice(raw) {
    if (typeof raw === 'number') return isFinite(raw) ? raw : null;
    var s = String(raw == null ? '' : raw).replace(/[^\d.,]/g, '');
    if (!s) return null;
    var lastDot = s.lastIndexOf('.');
    var lastComma = s.lastIndexOf(',');
    if (lastDot > -1 && lastComma > -1) {
      var dec = lastDot > lastComma ? '.' : ',';
      s = s.split(dec === '.' ? ',' : '.').join('').replace(',', '.');
    } else if (lastComma > -1) {
      s = /,\d{1,2}$/.test(s) ? s.split(',').map(function (p, i, a) { return i === a.length - 1 ? '.' + p : p; }).join('') : s.replace(/,/g, '');
    } else if (lastDot > -1 && (/\.\d{3}$/.test(s) || s.split('.').length > 2)) {
      s = /\.\d{1,2}$/.test(s) ? s.replace(/\.(?=.*\.)/g, '') : s.replace(/\./g, '');
    }
    var n = parseFloat(s);
    return isFinite(n) ? n : null;
  }

  function parseCurrency(code, rawPrice) {
    var c = clean(code).toUpperCase();
    if (/^[A-Z]{3}$/.test(c)) return c;
    var s = String(rawPrice || '') + ' ' + c;
    if (/CHF/i.test(s)) return 'CHF';
    if (/£/.test(s)) return 'GBP';
    if (/¥|円/.test(s)) return 'JPY';
    if (/\$/.test(s)) return 'USD';
    return 'EUR';
  }

  function formatPrice(w) {
    if (w.price == null) return 'Prix non renseigné';
    try {
      return new Intl.NumberFormat('fr-FR', {
        style: 'currency', currency: w.currency || 'EUR', maximumFractionDigits: w.price % 1 ? 2 : 0
      }).format(w.price);
    } catch (e) {
      return w.price + ' ' + (w.currency || '');
    }
  }

  function formatDate(iso) {
    if (!iso) return '';
    var d = new Date(iso + 'T12:00:00');
    return isNaN(d) ? iso : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function plural(n, one, many) { return n + ' ' + (n > 1 ? many : one); }

  function byPrice(a, b, dir) {
    if (a.price == null && b.price == null) return b.createdAt - a.createdAt;
    if (a.price == null) return 1;
    if (b.price == null) return -1;
    return (a.price - b.price) * dir;
  }

  // ---------------------------------------------------------------------------
  // Reconnaissance de la marque, du modèle et du diamètre à partir d'une page
  // ---------------------------------------------------------------------------

  var brandsByLength = KNOWN_BRANDS.slice().sort(function (a, b) { return b.length - a.length; });

  function brandPattern(brand) {
    var escaped = fold(brand).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/[\s-]+/g, '[\\s-]*');
    return new RegExp('(^|[^a-z0-9])' + escaped + '(?=$|[^a-z0-9])', 'i');
  }

  function detectBrand(text) {
    var folded = fold(text);
    for (var i = 0; i < brandsByLength.length; i++) {
      if (brandPattern(brandsByLength[i]).test(folded)) return brandsByLength[i];
    }
    return '';
  }

  function canonicalBrand(brand) {
    var f = fold(brand);
    for (var i = 0; i < KNOWN_BRANDS.length; i++) {
      if (fold(KNOWN_BRANDS[i]) === f) return KNOWN_BRANDS[i];
    }
    return clean(brand);
  }

  function stripSiteName(title, site, host) {
    var parts = title.split(/\s+[|–—·]\s+|\s+-\s+/);
    if (parts.length < 2) return title;
    var squash = function (x) { return fold(x).replace(/[^a-z0-9]/g, ''); };
    var last = squash(parts[parts.length - 1]);
    var hints = [squash(site), squash(host.split('.').slice(-2, -1)[0] || host)].filter(Boolean);
    var isSite = hints.some(function (h) { return last.indexOf(h) > -1 || h.indexOf(last) > -1; });
    return isSite ? parts.slice(0, -1).join(' - ') : title;
  }

  function removeBrand(title, brand) {
    if (!brand) return title;
    var folded = fold(title);
    var m = brandPattern(brand).exec(folded);
    if (!m) return title;
    var start = m.index + m[1].length;
    var end = m.index + m[0].length;
    // fold() conserve la longueur pour les caractères latins usuels.
    var rest = (title.slice(0, start) + ' ' + title.slice(end)).replace(/^[\s\-–|:,]+|[\s\-–|:,]+$/g, '');
    return clean(rest) || title;
  }

  function detectDiameter(text) {
    var re = /(\d{2}(?:[.,]\d{1,2})?)\s?mm/gi;
    var m;
    while ((m = re.exec(text))) {
      var n = num(m[1]);
      if (n >= 20 && n <= 55) return String(n).replace('.', ',');
    }
    return '';
  }

  function fromCapture(raw) {
    var url = safeUrl(raw.u);
    var host = hostOf(url);
    var site = clean(raw.s) || host;
    var title = clean(raw.t);
    var brand = canonicalBrand(raw.b) || detectBrand(title);
    var model = stripSiteName(title, site, host);
    model = removeBrand(model, brand);
    var w = blankWatch();
    w.url = url;
    w.site = site;
    w.brand = brand;
    w.model = model;
    w.price = parsePrice(raw.pr);
    w.currency = parseCurrency(raw.c, raw.pr);
    w.image = safeUrl(raw.i);
    w.reference = clean(raw.r);
    w.diameter = detectDiameter(title + ' ' + clean(raw.de));
    return w;
  }

  // ---------------------------------------------------------------------------
  // Données
  // ---------------------------------------------------------------------------

  function blankWatch() {
    var w = {
      id: uid(), createdAt: Date.now(), updatedAt: Date.now(),
      url: '', site: '', brand: '', model: '', price: null, currency: 'EUR', image: '',
      tried: false, triedAt: '', triedWhere: '', verdict: 'none', rating: 0, notes: '', compare: false
    };
    SPEC_FIELDS.forEach(function (f) { w[f.key] = ''; });
    return w;
  }

  function normalize(w) {
    var out = Object.assign(blankWatch(), w);
    if (!VERDICTS[out.verdict]) out.verdict = 'none';
    out.rating = Math.max(0, Math.min(5, Math.round(Number(out.rating) || 0)));
    out.price = out.price == null || out.price === '' ? null : parsePrice(out.price);
    out.tried = !!out.tried;
    out.compare = !!out.compare;
    return out;
  }

  function load() {
    try {
      var list = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(list) ? list.filter(function (w) { return w && w.id; }).map(normalize) : [];
    } catch (e) {
      return [];
    }
  }

  function persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state.watches));
    } catch (e) {
      toast('Impossible d\'enregistrer : le stockage du navigateur est plein ou bloqué.');
    }
  }

  function loadPrefs() {
    try {
      var p = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
      if (p.view === 'gallery' || p.view === 'compare') state.view = p.view;
      if (FILTERS.some(function (f) { return f.id === p.filter; })) state.filter = p.filter;
      if (SORTS[p.sort]) state.sort = p.sort;
    } catch (e) { /* préférences facultatives */ }
  }

  function savePrefs() {
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify({ view: state.view, filter: state.filter, sort: state.sort }));
    } catch (e) { /* préférences facultatives */ }
  }

  function find(id) {
    return state.watches.find(function (w) { return w.id === id; });
  }

  function update(id, changes) {
    var w = find(id);
    if (!w) return;
    Object.assign(w, changes, { updatedAt: Date.now() });
    persist();
    render();
  }

  function remove(id, withUndo) {
    var index = state.watches.findIndex(function (w) { return w.id === id; });
    if (index < 0) return;
    var removed = state.watches.splice(index, 1)[0];
    persist();
    render();
    if (withUndo) {
      state.lastDeleted = { watch: removed, index: index };
      toast('Montre supprimée.', 'Annuler', function () {
        if (!state.lastDeleted) return;
        state.watches.splice(state.lastDeleted.index, 0, state.lastDeleted.watch);
        state.lastDeleted = null;
        persist();
        render();
      });
    }
  }

  function visibleWatches() {
    var filter = FILTERS.find(function (f) { return f.id === state.filter; }) || FILTERS[0];
    var q = fold(state.query);
    return state.watches
      .filter(filter.test)
      .filter(function (w) {
        if (!q) return true;
        var hay = [w.brand, w.model, w.site, w.notes, w.triedWhere].concat(SPEC_FIELDS.map(function (f) { return w[f.key]; }));
        return fold(hay.join(' ')).indexOf(q) > -1;
      })
      .sort(SORTS[state.sort]);
  }

  // ---------------------------------------------------------------------------
  // Affichage
  // ---------------------------------------------------------------------------

  function render() {
    renderStats();
    renderFilters();
    renderTabs();
    renderBrandList();
    var main = $('#main');
    main.replaceChildren();
    if (!state.watches.length) {
      main.append(emptyState());
      return;
    }
    main.append(state.view === 'compare' ? compareView() : galleryView(visibleWatches()));
  }

  function renderStats() {
    var all = state.watches;
    var tried = all.filter(function (w) { return w.tried; }).length;
    var love = all.filter(function (w) { return w.verdict === 'love'; }).length;
    $('#stats').textContent = all.length
      ? [plural(all.length, 'montre', 'montres'), plural(tried, 'essayée', 'essayées'), plural(love, 'coup de cœur', 'coups de cœur')].join(' · ')
      : 'Ta sélection de montres';
  }

  function renderFilters() {
    var box = $('#filters');
    box.replaceChildren();
    FILTERS.forEach(function (f) {
      var count = state.watches.filter(f.test).length;
      box.append(el('button', {
        type: 'button',
        class: 'chip' + (state.filter === f.id ? ' active' : ''),
        'aria-pressed': String(state.filter === f.id),
        onclick: function () { state.filter = f.id; savePrefs(); render(); }
      }, f.label, el('span', { class: 'count' }, count)));
    });
  }

  function renderTabs() {
    document.querySelectorAll('.tabs [data-view]').forEach(function (b) {
      b.setAttribute('aria-selected', String(b.dataset.view === state.view));
    });
  }

  function renderBrandList() {
    var brands = new Set(KNOWN_BRANDS);
    state.watches.forEach(function (w) { if (w.brand) brands.add(w.brand); });
    $('#brand-list').replaceChildren.apply($('#brand-list'), Array.from(brands).sort().map(function (b) {
      return el('option', { value: b });
    }));
  }

  function emptyState() {
    return el('section', { class: 'empty' },
      svg(PLACEHOLDER_SVG),
      el('h2', {}, 'Aucune montre pour l\'instant'),
      el('p', {}, 'Installe le bouton « + Ma sélection » dans tes favoris : sur la page d\'une montre qui te plaît, un clic suffit pour l\'ajouter ici.'),
      el('div', { class: 'empty-actions' },
        el('button', { type: 'button', class: 'btn primary', onclick: openInstall }, 'Installer le bouton « 1 clic »'),
        el('button', { type: 'button', class: 'btn', onclick: function () { openEditor(null); } }, 'Ajouter à la main')
      )
    );
  }

  function noResults() {
    return el('p', { class: 'no-results' }, 'Aucune montre ne correspond à ces critères.');
  }

  function watchImage(w) {
    var src = safeUrl(w.image);
    if (!src) return svg(PLACEHOLDER_SVG);
    var img = el('img', { src: src, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' });
    img.addEventListener('error', function () { img.replaceWith(svg(PLACEHOLDER_SVG)); }, { once: true });
    return img;
  }

  function stars(w, interactive) {
    var box = el('div', { class: 'stars', 'aria-label': 'Note : ' + w.rating + ' sur 5' });
    for (var i = 1; i <= 5; i++) {
      (function (value) {
        var on = value <= w.rating;
        box.append(interactive
          ? el('button', {
            type: 'button', class: on ? 'on' : '', title: value + '/5', 'aria-label': 'Noter ' + value + ' sur 5',
            onclick: function () { update(w.id, { rating: w.rating === value ? 0 : value }); }
          }, '★')
          : el('span', { class: on ? 'on' : '' }, '★'));
      })(i);
    }
    return box;
  }

  function verdictBadge(w) {
    if (w.verdict === 'none') return null;
    return el('span', { class: 'badge verdict-' + w.verdict }, VERDICTS[w.verdict].short + ' ' + VERDICTS[w.verdict].label);
  }

  function specSummary(w) {
    var bits = [];
    if (w.diameter) bits.push(w.diameter + ' mm');
    if (w.movement) bits.push(w.movement);
    if (w.caseMaterial) bits.push(w.caseMaterial);
    return bits.length ? el('p', { class: 'card-specs' }, bits.join(' · ')) : null;
  }

  function toggle(label, checked, onChange) {
    return el('label', { class: 'toggle' },
      el('input', { type: 'checkbox', checked: checked, onchange: function (e) { onChange(e.target.checked); } }),
      label);
  }

  function verdictPicker(w) {
    var box = el('div', { class: 'verdict-picker', role: 'group', 'aria-label': 'Verdict' });
    ['love', 'maybe', 'no'].forEach(function (v) {
      box.append(el('button', {
        type: 'button',
        class: 'verdict-' + v + (w.verdict === v ? ' active' : ''),
        'aria-pressed': String(w.verdict === v),
        title: VERDICTS[v].label,
        onclick: function () { update(w.id, { verdict: w.verdict === v ? 'none' : v }); }
      }, VERDICTS[v].short, el('span', { class: 'label' }, ' ' + VERDICTS[v].label)));
    });
    return box;
  }

  function galleryView(list) {
    if (!list.length) return noResults();
    var grid = el('section', { class: 'grid' });
    list.forEach(function (w) {
      var url = safeUrl(w.url);
      grid.append(el('article', { class: 'card' + (w.verdict === 'no' ? ' rejected' : '') },
        el('button', { type: 'button', class: 'card-media', 'aria-label': 'Modifier ' + (w.brand + ' ' + w.model).trim(), onclick: function () { openEditor(w.id); } },
          watchImage(w),
          el('span', { class: 'badges' },
            w.tried ? el('span', { class: 'badge tried' }, '✓ Essayée') : null,
            verdictBadge(w))
        ),
        el('div', { class: 'card-body' },
          el('p', { class: 'card-brand' }, w.brand || 'Marque ?'),
          el('h3', { class: 'card-model' }, w.model || 'Modèle sans nom'),
          el('p', { class: 'card-price' + (w.price == null ? ' muted' : '') }, formatPrice(w)),
          specSummary(w),
          stars(w, true),
          w.tried ? verdictPicker(w) : null
        ),
        el('div', { class: 'card-actions' },
          toggle('Essayée', w.tried, function (on) {
            update(w.id, { tried: on, triedAt: on && !w.triedAt ? today() : w.triedAt });
          }),
          toggle('Comparer', w.compare, function (on) { update(w.id, { compare: on }); }),
          url ? el('a', { class: 'site-link', href: url, target: '_blank', rel: 'noopener noreferrer', title: url }, (w.site || hostOf(url)) + ' ↗') : null
        )
      ));
    });
    return grid;
  }

  function compareView() {
    var picked = state.watches.filter(function (w) { return w.compare; });
    var list = picked.length ? picked.slice().sort(SORTS[state.sort]) : visibleWatches();
    var wrap = el('section', { class: 'compare' });

    wrap.append(el('p', { class: 'compare-hint' },
      picked.length
        ? [plural(picked.length, 'montre cochée', 'montres cochées') + ' « Comparer ». ',
          el('button', { type: 'button', class: 'link', onclick: function () {
            state.watches.forEach(function (w) { w.compare = false; });
            persist();
            render();
          } }, 'Tout décocher')]
        : 'Toutes les montres du filtre sont affichées. Coche « Comparer » sur certaines montres pour ne garder qu\'elles ici.'
    ));

    if (!list.length) {
      wrap.append(noResults());
      return wrap;
    }

    var priced = list.filter(function (w) { return w.price != null; });
    var sameCurrency = priced.every(function (w) { return w.currency === (priced[0] && priced[0].currency); });
    var minPrice = sameCurrency && priced.length > 1 ? Math.min.apply(null, priced.map(function (w) { return w.price; })) : null;
    var maxRating = Math.max.apply(null, list.map(function (w) { return w.rating; }));

    var rows = [
      { label: 'Prix', cell: function (w) { return formatPrice(w); }, best: function (w) { return minPrice != null && w.price === minPrice; }, muted: function (w) { return w.price == null; } },
      { label: 'Essayée', cell: function (w) {
        if (!w.tried) return 'Pas encore';
        return ['✓ ', formatDate(w.triedAt), w.triedWhere ? ' — ' + w.triedWhere : ''].join('');
      }, muted: function (w) { return !w.tried; } },
      { label: 'Verdict', cell: function (w) { return verdictBadge(w) || '—'; } },
      { label: 'Note', cell: function (w) { return stars(w, true); }, best: function (w) { return list.length > 1 && maxRating > 0 && w.rating === maxRating; } }
    ];
    SPEC_FIELDS.forEach(function (f) {
      // Inutile d'afficher une caractéristique renseignée pour aucune montre.
      if (!list.some(function (w) { return w[f.key]; })) return;
      rows.push({
        label: f.label,
        cell: function (w) { return w[f.key] ? w[f.key] + (f.unit ? ' ' + f.unit : '') : '—'; },
        muted: function (w) { return !w[f.key]; }
      });
    });
    rows.push({ label: 'Notes perso', cell: function (w) { return w.notes || '—'; }, muted: function (w) { return !w.notes; }, cls: 'notes' });

    var table = el('table', { class: 'compare-table' });
    var head = el('tr', {}, el('th', { scope: 'col', class: 'corner' }, ''));
    list.forEach(function (w) {
      var url = safeUrl(w.url);
      head.append(el('th', { scope: 'col' },
        el('button', { type: 'button', class: 'compare-media', onclick: function () { openEditor(w.id); }, 'aria-label': 'Modifier' }, watchImage(w)),
        el('span', { class: 'card-brand' }, w.brand || 'Marque ?'),
        el('span', { class: 'compare-model' }, w.model || 'Modèle sans nom'),
        el('span', { class: 'compare-links' },
          url ? el('a', { href: url, target: '_blank', rel: 'noopener noreferrer' }, 'Voir ↗') : null,
          picked.length ? el('button', { type: 'button', class: 'link', onclick: function () { update(w.id, { compare: false }); } }, 'Retirer') : null)
      ));
    });
    table.append(el('thead', {}, head));

    var body = el('tbody');
    rows.forEach(function (r) {
      var tr = el('tr', {}, el('th', { scope: 'row' }, r.label));
      list.forEach(function (w) {
        var cls = [r.cls, r.best && r.best(w) ? 'best' : '', r.muted && r.muted(w) ? 'muted' : ''].filter(Boolean).join(' ');
        tr.append(el('td', { class: cls || null }, r.cell(w)));
      });
      body.append(tr);
    });
    table.append(body);
    wrap.append(el('div', { class: 'table-scroll' }, table));
    return wrap;
  }

  // ---------------------------------------------------------------------------
  // Formulaire d'édition
  // ---------------------------------------------------------------------------

  var form = $('#watch-form');
  var dialog = $('#watch-dialog');

  function buildForm() {
    var specs = $('#spec-fields');
    SPEC_FIELDS.forEach(function (f) {
      specs.append(el('label', { class: 'field' }, f.label,
        el('span', { class: 'with-unit' },
          el('input', { name: f.key, autocomplete: 'off', inputmode: f.numeric ? 'decimal' : null, placeholder: f.placeholder || null }),
          f.unit ? el('span', { class: 'unit' }, f.unit) : null)));
    });

    var verdict = $('#verdict-input');
    Object.keys(VERDICTS).forEach(function (v) {
      verdict.append(el('label', { class: 'verdict-' + v },
        el('input', { type: 'radio', name: 'verdict', value: v }),
        el('span', {}, v === 'none' ? VERDICTS[v].label : VERDICTS[v].short + ' ' + VERDICTS[v].label)));
    });

    var rating = $('#rating-input');
    for (var i = 1; i <= 5; i++) {
      (function (value) {
        rating.append(el('button', {
          type: 'button', 'aria-label': value + ' sur 5', dataset: { value: value },
          onclick: function () {
            var current = Number(form.elements.rating.value);
            setRating(current === value ? 0 : value);
          }
        }, '★'));
      })(i);
    }

    form.elements.image.addEventListener('input', updatePreview);
    form.elements.tried.addEventListener('change', function () {
      if (form.elements.tried.checked && !form.elements.triedAt.value) form.elements.triedAt.value = today();
      form.classList.toggle('is-tried', form.elements.tried.checked);
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      saveForm();
    });
    dialog.querySelectorAll('[data-close]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (b.id === 'btn-cancel' && state.quickAdd && state.quickAdd.isNew) {
          remove(state.editing, false);
          closeEditor('Ajout annulé.');
        } else {
          closeEditor();
        }
      });
    });
    // Échap : on ferme nous-mêmes pour terminer proprement un ajout rapide.
    dialog.addEventListener('cancel', function (e) {
      e.preventDefault();
      closeEditor();
    });
    $('#btn-delete').addEventListener('click', function () {
      var id = state.editing;
      var quick = state.quickAdd;
      if (!id || !find(id)) { closeEditor(); return; }
      remove(id, !quick);
      closeEditor(quick ? 'Montre retirée.' : null);
    });
  }

  function setRating(value) {
    form.elements.rating.value = value;
    $('#rating-input').querySelectorAll('button').forEach(function (b) {
      b.classList.toggle('on', Number(b.dataset.value) <= value);
    });
  }

  function updatePreview() {
    var box = $('#image-preview');
    box.replaceChildren(watchImage({ image: form.elements.image.value }));
  }

  function openEditor(id, opts) {
    opts = opts || {};
    var w = id ? find(id) : blankWatch();
    if (!w) return;
    state.editing = id || null;
    state.quickAdd = opts.quickAdd || null;

    $('#watch-dialog-title').textContent = id ? (opts.quickAdd ? 'Nouvelle montre' : 'Modifier la montre') : 'Ajouter une montre';
    $('#added-banner').hidden = !opts.banner;
    if (opts.banner) $('#added-banner').textContent = opts.banner;
    $('#btn-delete').hidden = !id;
    $('#btn-delete').textContent = opts.quickAdd ? 'Retirer' : 'Supprimer';
    $('#btn-cancel').textContent = opts.quickAdd && opts.quickAdd.isNew ? 'Annuler l\'ajout' : 'Annuler';

    ['url', 'brand', 'model', 'image', 'triedAt', 'triedWhere', 'notes'].concat(SPEC_FIELDS.map(function (f) { return f.key; }))
      .forEach(function (k) { form.elements[k].value = w[k] || ''; });
    form.elements.price.value = w.price == null ? '' : String(w.price).replace('.', ',');
    form.elements.currency.value = w.currency || 'EUR';
    form.elements.tried.checked = w.tried;
    form.classList.toggle('is-tried', w.tried);
    form.querySelector('input[name="verdict"][value="' + w.verdict + '"]').checked = true;
    setRating(w.rating);
    updatePreview();

    if (!dialog.open) dialog.showModal();
    if (!id) form.elements.url.focus();
  }

  function saveForm() {
    var f = form.elements;
    var data = {
      url: safeUrl(f.url.value) || clean(f.url.value),
      brand: canonicalBrand(f.brand.value),
      model: clean(f.model.value),
      price: parsePrice(f.price.value),
      currency: f.currency.value,
      image: safeUrl(f.image.value),
      tried: f.tried.checked,
      triedAt: f.tried.checked ? f.triedAt.value : '',
      triedWhere: clean(f.triedWhere.value),
      verdict: form.querySelector('input[name="verdict"]:checked').value,
      rating: Number(f.rating.value) || 0,
      notes: f.notes.value.trim()
    };
    SPEC_FIELDS.forEach(function (s) { data[s.key] = clean(f[s.key].value); });
    if (!data.site) data.site = hostOf(data.url);

    if (!data.brand && !data.model && !data.url) {
      toast('Indique au moins une marque, un modèle ou un lien.');
      return;
    }

    if (state.editing) {
      var existing = find(state.editing);
      if (existing && existing.url !== data.url) data.site = hostOf(data.url) || existing.site;
      else delete data.site;
      update(state.editing, data);
    } else {
      var dup = data.url && findByUrl(data.url);
      if (dup) {
        update(dup.id, data);
      } else {
        state.watches.unshift(Object.assign(blankWatch(), data));
        persist();
        render();
      }
    }

    closeEditor('Enregistrée ✓');
  }

  function findByUrl(url) {
    var key = urlKey(url);
    return state.watches.find(function (w) { return w.url && urlKey(w.url) === key; });
  }

  // ---------------------------------------------------------------------------
  // Ajout rapide (favori « + Ma sélection » et partage Android)
  // ---------------------------------------------------------------------------

  function handleIncoming() {
    var raw = null;
    var hash = location.hash;
    if (hash.indexOf('#add=') === 0) {
      raw = parseJson(hash.slice(5));
    } else {
      var params = new URLSearchParams(location.search);
      var shared = params.get('url') || ((params.get('text') || '').match(/https?:\/\/\S+/) || [])[0];
      if (shared) {
        var text = clean((params.get('text') || '').replace(shared, ''));
        raw = { u: shared, t: params.get('title') || text, s: hostOf(shared) };
      }
    }
    if (!raw) return;
    history.replaceState(null, '', location.pathname);

    var captured = fromCapture(raw);
    if (!captured.url && !captured.model) {
      toast('Impossible de lire cette page.');
      return;
    }
    var popup = raw.p === 1;
    var existing = captured.url && findByUrl(captured.url);
    if (existing) {
      openEditor(existing.id, { quickAdd: { popup: popup, isNew: false }, banner: 'Cette montre est déjà dans ta sélection.' });
      return;
    }
    state.watches.unshift(captured);
    persist();
    render();
    openEditor(captured.id, { quickAdd: { popup: popup, isNew: true }, banner: '✓ Ajoutée à ta sélection. Complète ou corrige si besoin.' });
  }

  function parseJson(encoded) {
    try { return JSON.parse(decodeURIComponent(encoded)); } catch (e) { /* déjà décodé ? */ }
    try { return JSON.parse(encoded); } catch (e) { return null; }
  }

  function closeEditor(message) {
    var quick = state.quickAdd;
    state.quickAdd = null;
    state.editing = null;
    if (dialog.open) dialog.close();
    if (message) toast(message);
    if (quick && quick.popup) {
      setTimeout(function () { window.close(); }, message ? 700 : 0);
    }
  }

  // ---------------------------------------------------------------------------
  // Installation du favori, import / export, notifications
  // ---------------------------------------------------------------------------

  function appUrl() {
    return location.origin + location.pathname;
  }

  function bookmarkletCode() {
    return 'javascript:' + encodeURIComponent('(' + watchGalleryGrab.toString() + ')(' + JSON.stringify(appUrl()) + ')');
  }

  function openInstall() {
    var link = $('#bookmarklet');
    link.href = bookmarkletCode();
    $('#install-warning').hidden = /^https?:$/.test(location.protocol);
    $('#install-dialog').showModal();
  }

  function setupInstall() {
    var d = $('#install-dialog');
    d.querySelector('[data-close]').addEventListener('click', function () { d.close(); });
    $('#bookmarklet').addEventListener('click', function (e) {
      e.preventDefault();
      toast('Glisse ce bouton dans ta barre de favoris plutôt que de cliquer dessus.');
    });
    $('#btn-copy-bookmarklet').addEventListener('click', function () {
      var code = bookmarkletCode();
      var done = function () { toast('Code copié ✓'); };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(code).then(done, function () { fallbackCopy(code); done(); });
      } else {
        fallbackCopy(code);
        done();
      }
    });
  }

  function fallbackCopy(text) {
    var ta = el('textarea', { readonly: true, style: 'position:fixed;opacity:0' });
    ta.value = text;
    document.body.append(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (e) { /* rien de plus à faire */ }
    ta.remove();
  }

  function exportData() {
    var payload = { app: 'watch-gallery', version: 1, exportedAt: new Date().toISOString(), watches: state.watches };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    var a = el('a', { href: URL.createObjectURL(blob), download: 'watch-gallery-' + today() + '.json' });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    closeMenu();
  }

  function importData(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(reader.result);
        var list = Array.isArray(data) ? data : data.watches;
        if (!Array.isArray(list)) throw new Error('format');
        var added = 0;
        var updated = 0;
        list.filter(function (w) { return w && w.id; }).map(normalize).forEach(function (w) {
          var current = find(w.id);
          if (!current) {
            state.watches.push(w);
            added++;
          } else if (w.updatedAt > current.updatedAt) {
            Object.assign(current, w);
            updated++;
          }
        });
        persist();
        render();
        toast(plural(added, 'montre ajoutée', 'montres ajoutées') + ', ' + plural(updated, 'mise à jour', 'mises à jour') + '.');
      } catch (e) {
        toast('Ce fichier n\'est pas une sélection Watch Gallery valide.');
      }
    };
    reader.readAsText(file);
    closeMenu();
  }

  function closeMenu() {
    $('.menu').removeAttribute('open');
  }

  var toastTimer = null;
  function toast(message, actionLabel, action) {
    var box = $('#toast');
    box.replaceChildren(el('span', {}, message));
    if (actionLabel) {
      box.append(el('button', { type: 'button', onclick: function () { box.classList.remove('show'); action(); } }, actionLabel));
    }
    box.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { box.classList.remove('show'); }, actionLabel ? 6000 : 3000);
  }

  // ---------------------------------------------------------------------------
  // Démarrage
  // ---------------------------------------------------------------------------

  function init() {
    loadPrefs();
    state.watches = load();
    buildForm();
    setupInstall();

    $('#btn-add').addEventListener('click', function () { openEditor(null); });
    $('#btn-install').addEventListener('click', openInstall);
    $('#btn-export').addEventListener('click', exportData);
    $('#import-file').addEventListener('change', function (e) {
      if (e.target.files[0]) importData(e.target.files[0]);
      e.target.value = '';
    });
    document.querySelectorAll('.tabs [data-view]').forEach(function (b) {
      b.addEventListener('click', function () { state.view = b.dataset.view; savePrefs(); render(); });
    });
    var sort = $('#sort');
    sort.value = state.sort;
    sort.addEventListener('change', function () { state.sort = sort.value; savePrefs(); render(); });
    $('#search').addEventListener('input', function (e) { state.query = e.target.value; render(); });
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.menu')) closeMenu();
    });

    // Une autre fenêtre (la petite fenêtre d'ajout) a modifié la sélection.
    window.addEventListener('storage', function (e) {
      if (e.key !== STORAGE_KEY) return;
      state.watches = load();
      render();
    });
    // La fenêtre d'ajout est réutilisée : seul le #add=… change.
    window.addEventListener('hashchange', handleIncoming);

    render();
    handleIncoming();

    if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
      navigator.serviceWorker.register('sw.js').catch(function () { /* hors ligne indisponible */ });
    }
  }

  init();
})();
