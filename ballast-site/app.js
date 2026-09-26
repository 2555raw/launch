// Ballast — simulated trade feed, basket builder with fee math, agent tabs,
// revoke demo and copy buttons. No dependencies.
(function () {
  "use strict";

  var SPLIT = { basket: 0.60, creator: 0.20, burn: 0.10, protocol: 0.10 };
  var FEE = 0.01;
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function $(id) { return document.getElementById(id); }

  function money(n) {
    if (n >= 1e6) return "$" + (n / 1e6).toFixed(n >= 1e7 ? 1 : 2).replace(/\.0+$/, "") + "M";
    if (n >= 1e4) return "$" + Math.round(n / 1e3).toLocaleString("en-US") + "K";
    return "$" + Math.round(n).toLocaleString("en-US");
  }

  /* ---------- simulated feed ---------- */
  var tape = $("tape");
  var basketTotal = 0.01963;
  var weights = { NVDA: 40, TSLA: 30, SPY: 30 };
  var seconds = 9 * 60 + 41;
  var holders = 1204;

  function addTrade() {
    var buy = Math.random() > 0.3;
    var size = Math.max(0.05, Math.round(Math.pow(Math.random(), 2) * 250) / 100);
    var fee = size * FEE;
    var toBasket = fee * SPLIT.basket;
    basketTotal += toBasket;
    var li = document.createElement("li");
    li.className = "new";
    li.innerHTML =
      '<span class="side ' + (buy ? "buy" : "sell") + '">' + (buy ? "BUY" : "SELL") + "</span>" +
      "<span>" + size.toFixed(2) + " ETH</span>" +
      '<span class="fee">fee ' + fee.toFixed(4) + "</span>" +
      '<span class="to">→ basket ' + toBasket.toFixed(5) + "</span>";
    tape.insertBefore(li, tape.firstChild);
    while (tape.children.length > 4) tape.removeChild(tape.lastChild);
    if (buy && Math.random() > 0.6) holders += 1;
    renderBasket();
  }

  function renderBasket() {
    var fills = document.querySelectorAll("#basket .fill");
    var pct = Math.min(96, 20 + (basketTotal / 0.05) * 76);
    fills.forEach(function (el) { el.style.width = pct.toFixed(1) + "%"; });
    document.querySelectorAll("#basket .amt").forEach(function (el) {
      var k = el.getAttribute("data-k");
      el.textContent = (basketTotal * weights[k] / 100).toFixed(5);
    });
    $("basketTotal").textContent = basketTotal.toFixed(5);
    $("holders").textContent = holders.toLocaleString("en-US");
  }

  function tick() {
    seconds -= 1;
    if (seconds <= 0) {
      seconds = 15 * 60;
      basketTotal = 0;
      renderBasket();
    }
    var m = Math.floor(seconds / 60), s = seconds % 60;
    $("countdown").textContent = (m < 10 ? "0" : "") + m + ":" + (s < 10 ? "0" : "") + s;
  }

  if (tape && !reduceMotion) {
    setInterval(tick, 1000);
    (function loop() {
      setTimeout(function () { addTrade(); loop(); }, 1400 + Math.random() * 2200);
    })();
  }

  /* ---------- builder ---------- */
  var form = $("builderForm");
  var picks = Array.prototype.slice.call(document.querySelectorAll("#picks input"));
  var weightsBox = $("weights");
  var state = { NVDA: 40, TSLA: 30, SPY: 30 };

  function selected() {
    return picks.filter(function (p) { return p.checked; }).map(function (p) { return p.value; });
  }

  // Keep weights whole numbers, each at least 5, that always sum to 100.
  function normalize(changed) {
    var keys = selected();
    keys.forEach(function (k) { if (state[k] == null) state[k] = Math.round(100 / keys.length); });
    Object.keys(state).forEach(function (k) { if (keys.indexOf(k) < 0) delete state[k]; });
    var others = keys.filter(function (k) { return k !== changed; });
    if (changed) state[changed] = Math.min(Math.max(state[changed], 5), 100 - 5 * others.length);
    var rest = 100 - (changed ? state[changed] : 0);
    var sum = others.reduce(function (a, k) { return a + state[k]; }, 0) || 1;
    others.forEach(function (k) { state[k] = Math.max(5, Math.floor(state[k] / sum * rest)); });
    var diff = rest - others.reduce(function (a, k) { return a + state[k]; }, 0);
    while (diff !== 0 && others.length) {
      var big = others.slice().sort(function (a, b) { return state[b] - state[a]; })[0];
      if (diff > 0) { state[big] += diff; diff = 0; }
      else {
        var take = Math.min(state[big] - 5, -diff);
        if (take <= 0) break;
        state[big] -= take;
        diff += take;
      }
    }
  }

  function renderWeights() {
    var keys = selected();
    weightsBox.innerHTML = keys.map(function (k) {
      return '<label class="weight"><span class="tk">' + k + '</span>' +
        '<input type="range" id="w-' + k + '" min="5" max="' + (100 - 5 * (keys.length - 1)) + '" value="' + state[k] + '">' +
        '<b class="mono">' + state[k] + "%</b></label>";
    }).join("");
  }

  function volumeValue() {
    var t = Number($("volume").value) / 100;
    var v = Math.pow(10, 4 + t * 3); // $10K → $10M
    var step = v >= 1e6 ? 1e5 : v >= 1e5 ? 1e4 : 1e3;
    return Math.round(v / step) * step;
  }

  function render() {
    var keys = selected();
    var name = ($("coinName").value || "Orbit").trim();
    var ticker = ($("coinTicker").value || "ORBIT").replace(/[^a-z0-9]/gi, "").toUpperCase() || "ORBIT";
    var chainSel = $("chain");
    var chainName = chainSel.options[chainSel.selectedIndex].text;

    $("pvName").firstChild.nodeValue = name + " ";
    $("pvTicker").textContent = "$" + ticker;
    $("pvChain").textContent = chainName;

    var mix = $("pvMix");
    mix.innerHTML = keys.map(function (k) {
      return '<span style="flex:' + state[k] + '">' + k + " " + state[k] + "</span>";
    }).join("");
    mix.setAttribute("aria-label", "Basket: " + keys.map(function (k) { return k + " " + state[k] + "%"; }).join(", "));

    var vol = volumeValue();
    var fee = vol * FEE;
    $("volLabel").textContent = money(vol);
    $("outBasket").textContent = money(fee * SPLIT.basket);
    $("outCreator").textContent = money(fee * SPLIT.creator);
    $("outBurn").textContent = money(fee * SPLIT.burn);
    $("outProtocol").textContent = money(fee * SPLIT.protocol);
    $("out30").textContent = money(fee * SPLIT.basket * 30);

    $("weightSum").textContent = keys.reduce(function (a, k) { return a + state[k]; }, 0) + "%";
    $("pickHint").textContent = keys.length + " of 3 to 5";
    picks.forEach(function (p) {
      p.disabled = (!p.checked && keys.length >= 5) || (p.checked && keys.length <= 3);
    });

    $("launchCmd").textContent = "!ballast launch " + ticker + " basket=" +
      keys.map(function (k) { return k + ":" + state[k]; }).join(",") + " chain=" + chainSel.value;
  }

  if (form) {
    form.addEventListener("submit", function (e) { e.preventDefault(); });
    picks.forEach(function (p) {
      p.addEventListener("change", function () { normalize(null); renderWeights(); render(); });
    });
    weightsBox.addEventListener("input", function (e) {
      if (e.target.type !== "range") return;
      var k = e.target.id.slice(2);
      state[k] = Number(e.target.value);
      normalize(k);
      selected().forEach(function (key) {
        var input = $("w-" + key);
        input.value = state[key];
        input.nextElementSibling.textContent = state[key] + "%";
      });
      render();
    });
    ["coinName", "coinTicker", "chain", "volume"].forEach(function (id) {
      $(id).addEventListener("input", render);
      $(id).addEventListener("change", render);
    });
    render();
  }

  /* ---------- agent tabs ---------- */
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.tabs [role="tab"]'));
  function selectTab(tab) {
    tabs.forEach(function (t) {
      var on = t === tab;
      t.setAttribute("aria-selected", on ? "true" : "false");
      t.tabIndex = on ? 0 : -1;
      $(t.getAttribute("aria-controls")).hidden = !on;
    });
  }
  tabs.forEach(function (t, i) {
    t.addEventListener("click", function () { selectTab(t); });
    t.addEventListener("keydown", function (e) {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      var next = tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
      selectTab(next);
      next.focus();
    });
  });

  /* ---------- revoke demo ---------- */
  var revoke = $("revokeBtn");
  if (revoke) {
    revoke.addEventListener("click", function () {
      var on = revoke.getAttribute("aria-pressed") !== "true";
      revoke.setAttribute("aria-pressed", on ? "true" : "false");
      revoke.textContent = on ? "Restore limits" : "Revoke all";
      $("limits").classList.toggle("revoked", on);
      var st = $("limitState");
      st.textContent = on ? "Revoked" : "Active";
      st.classList.toggle("off", on);
      $("revokeNote").textContent = on
        ? "Every delegation is off. Any action your agent tries now reverts."
        : "One call switches every delegation off on-chain. Your agent checks it before each action.";
    });
  }

  /* ---------- copy ---------- */
  document.addEventListener("click", function (e) {
    var btn = e.target.closest(".copy");
    if (!btn) return;
    var target = $(btn.getAttribute("data-copy-target"));
    if (!target) return;
    var text = target.textContent;
    var label = btn.textContent;
    function done(msg) {
      btn.textContent = msg;
      btn.classList.add("ok");
      setTimeout(function () { btn.textContent = label; btn.classList.remove("ok"); }, 1600);
    }
    function fallback() {
      var range = document.createRange();
      range.selectNodeContents(target);
      var sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      done("Selected");
    }
    try {
      navigator.clipboard.writeText(text).then(function () { done("Copied"); }, fallback);
    } catch (err) { fallback(); }
  });
})();
