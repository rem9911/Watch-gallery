/*
 * Code exécuté sur la page d'un site marchand quand on clique sur le favori
 * « + Ma sélection ». Il lit les informations de la montre affichée (données
 * structurées JSON-LD, balises Open Graph, plus grande image…) puis ouvre
 * Watch Gallery dans une petite fenêtre avec ces informations.
 *
 * La fonction est sérialisée telle quelle dans le favori (voir app.js) :
 * elle doit rester autonome, sans dépendance ni commentaire en ligne.
 */
function watchGalleryGrab(APP) {
  var d = document;

  function meta(names) {
    for (var i = 0; i < names.length; i++) {
      var n = names[i];
      var m = d.querySelector('meta[property="' + n + '"],meta[name="' + n + '"],meta[itemprop="' + n + '"]');
      if (m && m.content) return m.content.trim();
    }
    return '';
  }

  function abs(u) {
    try { return u ? new URL(u, location.href).href : ''; } catch (e) { return ''; }
  }

  function first(v) {
    return Array.isArray(v) ? v[0] : v;
  }

  function str(v) {
    return v == null ? '' : String(v).trim();
  }

  var product = null;
  var nodes = [];
  d.querySelectorAll('script[type="application/ld+json"]').forEach(function (s) {
    try { nodes.push(JSON.parse(s.textContent)); } catch (e) {}
  });
  while (nodes.length && !product) {
    var n = nodes.shift();
    if (!n || typeof n !== 'object') continue;
    if (Array.isArray(n)) { nodes = nodes.concat(n); continue; }
    var types = [].concat(n['@type'] || []);
    if (types.indexOf('Product') > -1 || types.indexOf('IndividualProduct') > -1 || types.indexOf('ProductModel') > -1) {
      product = n;
    } else {
      if (n['@graph']) nodes = nodes.concat(n['@graph']);
      if (n.mainEntity) nodes.push(n.mainEntity);
    }
  }

  var p = product || {};
  var offer = first(p.offers) || {};
  if (offer.offers) offer = first(offer.offers) || offer;
  var spec = offer.priceSpecification ? first(offer.priceSpecification) : {};

  var img = first(p.image);
  if (img && typeof img === 'object') img = img.url || img.contentUrl;
  img = img || meta(['og:image', 'og:image:url', 'og:image:secure_url', 'twitter:image', 'twitter:image:src']);
  if (!img) {
    var best = 0;
    [].forEach.call(d.images, function (im) {
      var w = Math.max(im.naturalWidth, im.width);
      var area = w * Math.max(im.naturalHeight, im.height);
      if (w >= 200 && area > best) { best = area; img = im.currentSrc || im.src; }
    });
  }

  var brand = first(p.brand);
  if (brand && typeof brand === 'object') brand = brand.name;

  var priceEl = d.querySelector('[itemprop="price"]');
  var price = str(offer.price || offer.lowPrice || spec.price)
    || meta(['product:price:amount', 'og:price:amount', 'price'])
    || (priceEl ? str(priceEl.getAttribute('content') || priceEl.textContent) : '');

  var data = {
    u: location.href,
    t: str(p.name) || meta(['og:title', 'twitter:title']) || d.title,
    i: abs(img),
    pr: price,
    c: str(offer.priceCurrency || spec.priceCurrency) || meta(['product:price:currency', 'og:price:currency', 'priceCurrency']),
    b: str(brand),
    r: str(p.mpn) || (typeof p.model === 'string' ? p.model : ''),
    s: meta(['og:site_name']) || location.hostname.replace(/^www\./, ''),
    de: (str(p.description) || meta(['og:description', 'description'])).slice(0, 500),
    p: 1
  };

  var w = window.open(APP + '#add=' + encodeURIComponent(JSON.stringify(data)), 'watchgallery', 'width=560,height=820');
  if (!w) alert('Watch Gallery : autorisez les fenêtres pop-up pour ce site afin d\'ajouter la montre.');
}
