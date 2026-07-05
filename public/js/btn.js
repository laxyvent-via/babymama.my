// Lamda — Button Animation System
// Shared module for all button progress/success/error states

window.Btn = (function(){
  'use strict';

  const DFL = {
    loadingText: '\u23F3 Memproses...',
    successText: '\u2705 Selesai!',
    errorText: '\u274C Gagal',
    successDuration: 1800,
    errorDuration: 2200,
    addedText: '\u2705 Ditambah',
    addedDuration: 1200
  };

  /**
   * Wrap an async function with loading → success/error animation.
   * @param {HTMLButtonElement} btn
   * @param {() => Promise<any>} fn — async work
   * @param {object} opts
   * @param {string} [opts.text] — original button text (default: btn.textContent)
   * @param {string} [opts.loadingText]
   * @param {string} [opts.successText]
   * @param {string} [opts.errorText]
   * @param {number} [opts.duration] — success flash duration ms
   * @returns {Promise<any>}
   */
  async function action(btn, fn, opts) {
    opts = opts || {};
    const text = opts.text !== undefined ? opts.text : (btn.textContent || '');
    const loadingText = opts.loadingText || DFL.loadingText;
    const successText = opts.successText || DFL.successText;
    const errorText = opts.errorText || DFL.errorText;
    const duration = opts.duration || DFL.successDuration;

    btn.disabled = true;
    btn.classList.add('btn--loading');
    btn.textContent = loadingText;

    try {
      const result = await fn();
      btn.classList.remove('btn--loading');
      btn.classList.add('btn--success');
      btn.textContent = successText;
      setTimeout(() => {
        btn.textContent = text;
        btn.classList.remove('btn--success');
        btn.disabled = false;
      }, duration);
      return result;
    } catch (e) {
      btn.classList.remove('btn--loading');
      btn.classList.add('btn--error');
      btn.textContent = errorText;
      setTimeout(() => {
        btn.textContent = text;
        btn.classList.remove('btn--error');
        btn.disabled = false;
      }, DFL.errorDuration);
      throw e;
    }
  }

  /**
   * Quick success pop for instant actions (qty change, add to cart).
   * @param {HTMLElement} el
   */
  function pulse(el) {
    el.classList.remove('btn--pulse');
    void el.offsetWidth; // force reflow
    el.classList.add('btn--pulse');
  }

  /**
   * Mark a button as "added" with green pop + text change.
   * @param {HTMLElement} btn
   * @param {string} [text]
   */
  function added(btn, text) {
    btn.textContent = text || DFL.addedText;
    btn.classList.remove('btn--added');
    void btn.offsetWidth;
    btn.classList.add('btn--added');
    setTimeout(() => btn.classList.remove('btn--added'), DFL.addedDuration);
  }

  /**
   * Error shake without async wrapper.
   * @param {HTMLElement} btn
   * @param {string} [text]
   */
  function shake(btn, text) {
    btn.classList.remove('btn--error');
    void btn.offsetWidth;
    btn.classList.add('btn--error');
    if (text !== undefined) btn.textContent = text;
    setTimeout(() => btn.classList.remove('btn--error'), DFL.errorDuration);
  }

  return { action, pulse, added, shake };
})();
