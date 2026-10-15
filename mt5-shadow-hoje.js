/* Painel MT5 ActivTrades: visualizacao apenas, nao alimenta modelos nem confluencia. */
(function () {
  "use strict";
  var symbols = ["DXY_SYNTH", "EURUSD", "USDJPY", "GBPUSD", "USDCAD", "USDSEK", "USDCHF"];
  var section = document.getElementById("hoje");
  if (!section) return;
  var card = document.createElement("article");
  card.className = "card gap-top rd-mt5-card";
  card.innerHTML = '<div class="rd-mt5-header"><div><div class="ct">Forex · ActivTrades MT5</div>' +
    '<div class="rd-mt5-note">Leitura de precos · DXY sintetico experimental · fora da confluencia</div></div>' +
    '<span id="rdMt5Status" class="badge">Aguardando fonte</span></div>' +
    '<div id="rdMt5Pairs" class="rd-mt5-grid" aria-live="polite"></div>' +
    '<div id="rdMt5Time" class="rd-mt5-footer">Sem cotacoes publicadas</div>';
  var anchor = section.querySelector(".product-events");
  if (anchor) section.insertBefore(card, anchor);
  else section.appendChild(card);
  var host = document.getElementById("rdMt5Pairs");
  var state = document.getElementById("rdMt5Status");
  var footer = document.getElementById("rdMt5Time");
  var lastRows = [];
  var lastError = "";
  function fmt(symbol, number) {
    if (number == null || !Number.isFinite(Number(number))) return "—";
    var places = symbol === "DXY_SYNTH" ? 4 : symbol === "USDJPY" ? 3 : 5;
    return Number(number).toLocaleString("pt-BR", {minimumFractionDigits: places, maximumFractionDigits: places});
  }
  function stamp(t) {
    if (!t || !Number.isFinite(Date.parse(t))) return "sem horario";
    return new Intl.DateTimeFormat("pt-BR", {timeZone: "America/Sao_Paulo", day:"2-digit",
      month:"2-digit", hour:"2-digit", minute:"2-digit", second:"2-digit"}).format(new Date(t)) + " BRT";
  }
  function age(row) {
    var x = row && Date.parse(row.as_of_utc);
    return Number.isFinite(x) ? (Date.now() - x) / 1000 : Infinity;
  }
  function draw() {
    var by = {};
    lastRows.forEach(function (r) { if (symbols.indexOf(r.symbol) >= 0 && r.source === "MT5_ACTIVTRADES_SHADOW") by[r.symbol] = r; });
    var all = symbols.map(function (s) { return by[s]; });
    var available = all.filter(Boolean);
    var ready = available.length === symbols.length && available.every(function (r) {
      return age(r) >= -10 && age(r) <= 90 && r.quality_status === "RECENT" && r.mid != null;
    });
    state.className = "badge " + (ready ? "bgood" : available.length ? "bwarn" : "");
    state.textContent = ready ? "COTACOES RECENTES · SHADOW" : available.length ? "DADOS PARCIAIS / ANTIGOS" : "AGUARDANDO COLETA";
    host.textContent = "";
    symbols.forEach(function (symbol) {
      var row = by[symbol], valid = row && row.quality_status === "RECENT" && age(row) >= -10 && age(row) <= 90;
      var item = document.createElement("div");
      item.className = "rd-mt5-item" + (symbol === "DXY_SYNTH" ? " rd-mt5-dxy" : "");
      var label = document.createElement("span");
      label.className = "rd-mt5-label";
      label.textContent = symbol === "DXY_SYNTH" ? "DXY sintético" : symbol;
      var val = document.createElement("strong");
      val.className = valid ? "rd-mt5-value" : "rd-mt5-value rd-mt5-stale";
      val.textContent = row ? fmt(symbol, row.mid) : "—";
      var status = document.createElement("small");
      status.textContent = !row ? "Sem dados" : valid ? "Recente*" : "Atrasado / indisponível";
      item.append(label, val, status);
      host.appendChild(item);
    });
    if (available.length) {
      var latest = available.reduce(function (a,b) { return age(a) <= age(b) ? a : b; });
      footer.textContent = "Ultima coleta: " + stamp(latest.as_of_utc) +
        " · *Recente pelo relogio da fonte; latencia externa nao comprovada. Sem sinal operacional.";
    } else footer.textContent = lastError ?
      "Fonte ainda nao configurada ou indisponivel; nenhuma cotacao simulada." :
      "Aguardando publicacao da fonte ActivTrades; nenhum valor ficticio.";
  }
  async function refresh() {
    try {
      if (typeof api !== "function") throw Error("API indisponivel");
      var rows = await api("riskdesk_mt5_fx_shadow",
        "select=symbol,mid,as_of_utc,quality_status,source&order=symbol.asc");
      lastRows = Array.isArray(rows) ? rows : [];
      lastError = "";
    } catch (err) {
      lastError = String(err && err.message || err);
      lastRows = [];
    }
    draw();
  }
  refresh();
  setInterval(function () { if (document.visibilityState !== "hidden") refresh(); }, 15000);
  setInterval(function () { if (document.visibilityState !== "hidden") draw(); }, 5000);
})();
