/* BABYMAMA TRACKING — Facebook Pixel + TikTok Pixel
 * Set real IDs below, then deploy.
 * Pixel only runs when ID is not empty and not REPLACE_*.
 */
(function () {
  'use strict';

  var CONFIG = {
    facebookPixelId: 'REPLACE_FB_PIXEL_ID',
    tiktokPixelId: 'D95RFF3C77U79CKEQM00',
    currency: 'MYR',
    debug: false
  };

  function isRealId(value) {
    return value && !/^REPLACE_/i.test(value) && !/^YOUR_/i.test(value);
  }

  function log() {
    if (!CONFIG.debug) return;
    try { console.log.apply(console, ['[BBM Tracking]'].concat([].slice.call(arguments))); } catch (e) {}
  }

  function safeNumber(value) {
    var n = Number(value || 0);
    return isFinite(n) ? n : 0;
  }

  function cleanPayload(payload) {
    var out = {};
    payload = payload || {};
    Object.keys(payload).forEach(function (key) {
      if (payload[key] !== undefined && payload[key] !== null && payload[key] !== '') out[key] = payload[key];
    });
    return out;
  }

  function initFacebook() {
    if (!isRealId(CONFIG.facebookPixelId) || window.fbq) return;
    !function(f,b,e,v,n,t,s){
      if(f.fbq)return;n=f.fbq=function(){n.callMethod?
      n.callMethod.apply(n,arguments):n.queue.push(arguments)};
      if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
      n.queue=[];t=b.createElement(e);t.async=!0;
      t.src=v;s=b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t,s)}(window, document,'script','https://connect.facebook.net/en_US/fbevents.js');
    window.fbq('init', CONFIG.facebookPixelId);
    log('Facebook Pixel initialized');
  }

  function initTikTok() {
    if (!isRealId(CONFIG.tiktokPixelId) || window.ttq) return;
    !function (w, d, t) {
      w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];
      ttq.methods=['page','track','identify','instances','debug','on','off','once','ready','alias','group','enableCookie','disableCookie'];
      ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};
      for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);
      ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e};
      ttq.load=function(e,n){var i='https://analytics.tiktok.com/i18n/pixel/events.js';ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=i;ttq._t=ttq._t||{};ttq._t[e]=+new Date;ttq._o=ttq._o||{};ttq._o[e]=n||{};var o=d.createElement('script');o.type='text/javascript';o.async=!0;o.src=i+'?sdkid='+e+'&lib='+t;var a=d.getElementsByTagName('script')[0];a.parentNode.insertBefore(o,a)};
      ttq.load(CONFIG.tiktokPixelId);
      log('TikTok Pixel initialized');
    }(window, document, 'ttq');
  }

  function fbTrack(eventName, payload) {
    if (!window.fbq) return;
    try { window.fbq('track', eventName, cleanPayload(payload)); } catch (e) { log('fbq error', e); }
  }

  function ttTrack(eventName, payload) {
    if (!window.ttq) return;
    try { window.ttq.track(eventName, cleanPayload(payload)); } catch (e) { log('ttq error', e); }
  }

  function productPayload(product, extra) {
    product = product || {};
    extra = extra || {};
    var price = safeNumber(product.promo_price || product.price || product.value || extra.value);
    return Object.assign({
      content_name: product.name || extra.content_name || 'Babymama Product',
      content_id: String(product.slug || product.id || extra.content_id || ''),
      content_ids: [String(product.slug || product.id || extra.content_id || '')],
      content_type: 'product',
      value: price,
      currency: CONFIG.currency
    }, extra);
  }

  function track(eventName, payload) {
    payload = cleanPayload(payload || {});
    log(eventName, payload);
    fbTrack(eventName, payload);
    ttTrack(eventName, payload);
  }

  function pageView(payload) {
    payload = cleanPayload(payload || {});
    if (window.fbq) window.fbq('track', 'PageView', payload);
    if (window.ttq) window.ttq.page();
    log('PageView', payload);
  }

  initFacebook();
  initTikTok();

  window.BBMTracking = {
    config: CONFIG,
    isEnabled: function () { return isRealId(CONFIG.facebookPixelId) || isRealId(CONFIG.tiktokPixelId); },
    pageView: pageView,
    viewContent: function (product, extra) { track('ViewContent', productPayload(product, extra)); },
    addToCart: function (product, extra) { track('AddToCart', productPayload(product, extra)); },
    initiateCheckout: function (payload) { track('InitiateCheckout', Object.assign({ currency: CONFIG.currency }, payload || {})); },
    contact: function (payload) { track('Contact', Object.assign({ currency: CONFIG.currency }, payload || {})); },
    lead: function (payload) { track('Lead', Object.assign({ currency: CONFIG.currency }, payload || {})); },
    track: track
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { pageView({ page_path: location.pathname }); });
  } else {
    pageView({ page_path: location.pathname });
  }
})();
