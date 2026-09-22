/* ===========================================================================
   Propello — the eligibility gate. Before a wallet is connected for the first
   time the visitor confirms where they live, that they have read the risks,
   and that this is a security. Their answer is kept in this browser only.
   =========================================================================== */
(function () {
  'use strict';
  var C = window.PROPELLO_CONFIG || {};
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var gate = $('#gate'); if (!gate) return;
  var KEY = 'propello.eligible.v1';
  var after = null, lastFocus = null;

  function accepted() { try { return localStorage.getItem(KEY) === 'yes'; } catch (e) { return false; } }
  function remember() { try { localStorage.setItem(KEY, 'yes'); } catch (e) {} }

  /* fill the jurisdiction lists from config */
  var el = $('#gate-eligible'); if (el && C.eligible) el.textContent = C.eligible.join(', ');
  var no = $('#gate-not'); if (no && C.notOffered) no.textContent = C.notOffered.join(', ');
  var kyc = $('#gate-kyc');
  if (kyc) { if (C.kycUrl) { kyc.href = C.kycUrl; } else { kyc.removeAttribute('href'); kyc.classList.add('is-off'); kyc.setAttribute('aria-disabled', 'true'); kyc.textContent = document.documentElement.lang === 'zh' ? '身份验证——服务商尚未配置' : 'Identity check — provider not configured yet'; } }

  function open(cb) {
    after = cb;
    if (accepted()) { after && after(); return; }
    lastFocus = document.activeElement;
    gate.hidden = false;
    document.body.classList.add('rt-locked');
    requestAnimationFrame(function () { gate.classList.add('is-on'); $('input', gate).focus(); });
    check();
  }
  function close() {
    gate.classList.remove('is-on');
    document.body.classList.remove('rt-locked');
    setTimeout(function () { gate.hidden = true; if (lastFocus && lastFocus.focus) lastFocus.focus(); }, 220);
  }
  function check() {
    var ok = $$('input[type=checkbox]', gate).every(function (i) { return i.checked; });
    $('#gate-continue').disabled = !ok;
  }
  $$('input[type=checkbox]', gate).forEach(function (i) { i.addEventListener('change', check); });
  $('#gate-continue').addEventListener('click', function () { remember(); close(); setTimeout(function () { after && after(); }, 240); });
  $$('[data-gate-close]', gate).forEach(function (b) { b.addEventListener('click', close); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !gate.hidden) close(); });

  window.PROPELLO_GATE = { open: open, accepted: accepted, reset: function () { try { localStorage.removeItem(KEY); } catch (e) {} } };
})();
