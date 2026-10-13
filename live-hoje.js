/* Risk Desk V10 — pagina Hoje: leitura independente, sem sinais operacionais. */
(function () {
  "use strict";

  var ASSETS = ["NQ", "ZN", "ZT", "ZQ", "DXY", "VIX", "VXN"];
  // Limites apenas visuais; nao definem horario de negociacao nem validade operacional.
  var DISPLAY_MIN = {NQ: 3, ZN: 3, ZT: 5, ZQ: 10, DXY: 15, VIX: 15, VXN: 15};
  var current = {quotes: null, market: null, event: null, regime: null, sigma: null};
  var errors = {};
  var requestId = 0;

  function el(id) { return document.getElementById(id); }
  function clean(x) { return esc(x == null ? "—" : x); }
  function validTime(x) {
    var d = x ? new Date(x) : null;
    return d && Number.isFinite(d.getTime()) ? d : null;
  }
  function ageMinutes(x) {
    var d = validTime(x);
    return d ? Math.max(0, (Date.now() - d.getTime()) / 60000) : null;
  }
  function ageLabel(minutes) {
    if (minutes == null) return "Sem horario";
    if (minutes < 1) return Math.round(minutes * 60) + " s";
    if (minutes < 120) return minutes.toFixed(1).replace(".", ",") + " min";
    return (minutes / 60).toFixed(1).replace(".", ",") + " h";
  }
  function dateLabel(x) { return validTime(x) ? utc(x) : "Sem horario"; }
  function priceLabel(x) {
    return x == null || !Number.isFinite(Number(x)) ? "—" :
      new Intl.NumberFormat("pt-BR", {maximumFractionDigits: 8}).format(Number(x));
  }
  function chip(label, css) {
    return '<span class="rd-chip ' + css + '">' + clean(label) + '</span>';
  }
  function slot(id, msg) {
    var target = el(id);
    if (target) target.innerHTML = '<div class="rd-empty">' + clean(msg) + '</div>';
  }

  function quoteState(q, minutes) {
    if (!q) return ["Indisponivel", "rd-danger"];
    if (q.quality_status === "OFF_SESSION_SOURCE") return ["Fora da sessao", "rd-neutral"];
    if (q.quality_status !== "OK") return [q.quality_status || "Qualidade desconhecida", "rd-warning"];
    if (minutes == null) return ["Horario desconhecido", "rd-warning"];
    var limit = DISPLAY_MIN[q.asset] || 5;
    if (minutes <= limit) return ["Recente", "rd-good"];
    if (minutes <= limit * 2) return ["Atencao", "rd-warning"];
    return ["Defasado", "rd-danger"];
  }
  function quoteDetail(q) {
    if (!q) return "Sem cotacao";
    return clean(q.source) + (q.contract ? " · " + clean(q.contract) : "");
  }
  function renderQuotes() {
    var target = el("rdFreshness");
    if (!target) return;
    if (errors.quotes) return slot("rdFreshness", "Nao foi possivel consultar cotacoes: " + errors.quotes);
    if (!Array.isArray(current.quotes)) return slot("rdFreshness", "Consultando cotacoes...");
    var byAsset = {};
    current.quotes.forEach(function (q) { if (q && ASSETS.indexOf(q.asset) >= 0) byAsset[q.asset] = q; });
    target.innerHTML = '<div class="rd-table-wrap"><table class="rd-table"><thead><tr>' +
      '<th>Ativo / contrato</th><th>Ultimo preco</th><th>Hora da cotacao (UTC)</th>' +
      '<th>Idade da cotacao</th><th>Estado / fonte</th></tr></thead><tbody>' +
      ASSETS.map(function (asset) {
        var q = byAsset[asset], age = q ? ageMinutes(q.ts_utc) : null;
        var state = quoteState(q, age);
        return '<tr><td><b>' + asset + '</b><div class="rd-sub">' + (q ? clean(q.symbol) : "Sem registro") + '</div></td>' +
          '<td class="rd-numeric">' + priceLabel(q && q.price) + '</td>' +
          '<td>' + dateLabel(q && q.ts_utc) + '<div class="rd-sub">Recebido: ' + dateLabel(q && q.received_at) + '</div></td>' +
          '<td>' + ageLabel(age) + '</td>' +
          '<td>' + chip(state[0], state[1]) + '<div class="rd-sub">' + quoteDetail(q) + '</div></td></tr>';
      }).join("") + '</tbody></table></div>' +
      '<p class="rd-footnote">A idade usa o timestamp da cotacao, nao o heartbeat. Os limites (NQ/ZN: 3 min; ZT: 5 min; ZQ: 10 min; DXY/VIX/VXN: 15 min) sao alertas visuais, nao atestados de mercado aberto. "OK" e qualidade de registro, nao garantia de preco instantaneo.</p>';
  }

  var FACTORS = [
    ["Politica (ZQ)", "policy_reading", "ZQ"],
    ["Juros 2 anos (ZT)", "rates_2y_reading", "ZT"],
    ["Juros 10 anos (ZN)", "rates_10y_reading", "ZN"],
    ["Risco (NQ)", "risk_reading", "NQ"],
    ["Dolar (DXY)", "dollar_reading", "DXY"],
    ["Sigma NY", "sigma_reading", null],
    ["Regime macro", "regime_reading", null]
  ];
  function rawReading(x) {
    var translations = {
      FLAT: "Estavel", YIELD_PRESSURE_UP: "Pressao de juros para cima",
      YIELD_PRESSURE_DOWN: "Pressao de juros para baixo",
      RISK_ON_NQ_UP: "NQ em alta", RISK_OFF_NQ_DOWN: "NQ em baixa",
      UNAVAILABLE: "Indisponivel", OUTSIDE_NY_SESSION: "Fora da sessao NY",
      TRANSITION_OR_INSUFFICIENT: "Transicao / insuficiente",
      NOT_APPLICABLE_TO_PRE_EVENT_WINDOW: "Nao aplicavel a janela"
    };
    return translations[x] || x || "Sem leitura";
  }
  function factorSourceAge(key, asset, qMap) {
    if (asset && qMap[asset]) return "Cotacao: " + ageLabel(ageMinutes(qMap[asset].ts_utc));
    if (key === "sigma_reading" && current.sigma) {
      return "Estado: " + clean(current.sigma.status) + " · Motor: " + ageLabel(ageMinutes(current.sigma.as_of_utc));
    }
    if (key === "regime_reading" && current.regime) {
      return "Baseline: " + (current.regime.freshness_days == null ? "sem idade" : clean(current.regime.freshness_days) + " dias") +
        " · " + clean(current.regime.status);
    }
    return "Sem fonte individual verificada";
  }
  function renderMarket() {
    var target = el("rdFactors");
    if (!target) return;
    if (errors.market) return slot("rdFactors", "Nao foi possivel consultar Market State: " + errors.market);
    var m = current.market;
    if (!m) return slot("rdFactors", "Sem Market State LIVE disponivel.");
    var qMap = {};
    (current.quotes || []).forEach(function (x) { qMap[x.asset] = x; });
    var missed = Array.isArray(m.missing_assets) ? m.missing_assets : [];
    var status = m.data_status || m.market_state || "INDETERMINATE";
    var authorized = m.composite_authorized === true;
    target.innerHTML = '<div class="rd-summary">' +
      chip(status, authorized ? "rd-good" : "rd-warning") +
      '<strong>' + clean(m.active_factors == null ? "—" : m.active_factors) + ' fator(es) ativo(s)</strong>' +
      '<span class="rd-sub">J7D LIVE · ' + dateLabel(m.as_of_utc) + '</span></div>' +
      '<div class="rd-factor-list">' + FACTORS.map(function (f) {
        var raw = m[f[1]];
        var unavailable = !raw || /UNAVAILABLE|OUTSIDE|INSUFFICIENT|NOT_APPLICABLE/.test(raw) ||
          (f[2] && missed.indexOf(f[2]) >= 0);
        return '<div class="rd-factor"><span class="rd-factor-name">' + clean(f[0]) +
          '<small>' + factorSourceAge(f[1], f[2], qMap) + '</small></span><span>' +
          chip(rawReading(raw), unavailable ? "rd-neutral" : "rd-outline") +
          '<small class="rd-raw">' + clean(raw || "NULL") + '</small></span></div>';
      }).join("") + '</div>' +
      '<p class="rd-footnote">Estado J7D: ' + clean(m.market_state) + '. Ativos ausentes no calculo: ' +
      clean(missed.length ? missed.join(", ") : "nenhum informado") +
      '. Composto autorizado: ' + (authorized ? "SIM (apenas status da fonte)" : "NAO") +
      '. Sinal operacional: NAO AUTORIZADO. Uma cotacao existente nao significa que o J7D a aceitou no calculo.</p>';
  }
  function renderEvent() {
    var target = el("rdEventConfluence");
    if (!target) return;
    if (errors.event) return slot("rdEventConfluence", "Nao foi possivel consultar confluencia: " + errors.event);
    var c = current.event;
    if (!c) return slot("rdEventConfluence", "Sem proximo evento com confluencia cadastrada.");
    var count = Math.max(0, Number(c.directional_layers_available) || 0);
    var up = Math.max(0, Number(c.up_layers) || 0), down = Math.max(0, Number(c.down_layers) || 0);
    var upPct = count > 0 ? Math.min(100, up / count * 100) : 0;
    var downPct = count > 0 ? Math.min(100 - upPct, down / count * 100) : 0;
    target.innerHTML = '<div class="rd-summary"><b>' + clean(c.event_family || "Evento") + '</b>' +
      '<span class="rd-sub">' + dateLabel(c.scheduled_ts_utc) + '</span>' +
      chip(c.confluence_level || "INDETERMINATE", "rd-warning") + '</div>' +
      '<div class="rd-totals"><div><strong>' + count + '</strong><span>Camadas validas</span></div>' +
      '<div><strong>' + up + '</strong><span>Alta</span></div><div><strong>' + down + '</strong><span>Baixa</span></div></div>' +
      (count > 0 ? '<div class="rd-meter" aria-label="Camadas de alta e baixa apuradas">' +
        '<span class="rd-meter-up" style="width:' + upPct.toFixed(1) + '%"></span>' +
        '<span class="rd-meter-down" style="width:' + downPct.toFixed(1) + '%"></span></div>' :
        '<div class="rd-no-evidence">Sem camadas direcionais comprovadas para exibir no grafico.</div>') +
      '<div class="rd-factor"><span>Cobertura da evidencia</span><b>' + clean(c.evidence_coverage) + '</b></div>' +
      '<div class="rd-factor"><span>Direcao registrada</span><b>' + clean(c.direction) + '</b></div>' +
      '<p class="rd-footnote">Camadas sao contagens informadas pela view, nao probabilidade de acerto. ' +
      'Nenhum resultado da confluencia autoriza entradas, filtro operacional ou probabilidade de lucro.</p>';
  }

  async function refreshHoje() {
    var token = ++requestId;
    var next = new Date().toISOString();
    var queries = [
      ["quotes", "riskdesk_live_latest_quotes_v1", "select=asset,symbol,contract,price,source,ts_utc,received_at,quality_status"],
      ["market", "riskdesk_live_market_state_latest_v1", "select=as_of_utc,window,active_factors,market_state,data_status,missing_assets,composite_authorized,trade_signal_authorized,policy_reading,rates_2y_reading,rates_10y_reading,risk_reading,dollar_reading,sigma_reading,regime_reading&window=eq.LIVE&order=as_of_utc.desc&limit=1"],
      ["event", "riskdesk_product_confluence_v1", "select=event_family,scheduled_ts_utc,confluence_level,evidence_coverage,directional_layers_available,up_layers,down_layers,direction,operational_authorized&scheduled_ts_utc=gte." + encodeURIComponent(next) + "&order=scheduled_ts_utc.asc&limit=1"],
      ["regime", "riskdesk_live_regime_latest_v1", "select=as_of_utc,status,freshness_days,carry_forward&limit=1"],
      ["sigma", "riskdesk_live_sigma_latest_v1", "select=as_of_utc,status&limit=1"]
    ];
    var outcomes = await Promise.allSettled(queries.map(function (q) { return api(q[1], q[2]); }));
    if (token !== requestId) return;
    queries.forEach(function (q, i) {
      if (outcomes[i].status === "fulfilled") {
        current[q[0]] = ["quotes"].indexOf(q[0]) >= 0 ? outcomes[i].value : outcomes[i].value[0] || null;
        delete errors[q[0]];
      } else {
        errors[q[0]] = String(outcomes[i].reason && outcomes[i].reason.message || outcomes[i].reason);
      }
    });
    if (!errors.quotes && Array.isArray(current.quotes)) {
      window.riskDeskQuoteFeed = current.quotes;
      if (typeof renderDirectionalGraph === "function") renderDirectionalGraph();
    }
    renderQuotes(); renderMarket(); renderEvent();
    if (el("rdLastQuery")) el("rdLastQuery").textContent = "Consulta ao Supabase: " + new Date().toLocaleTimeString("pt-BR");
  }
  el("refresh").addEventListener("click", refreshHoje);
  refreshHoje();
  setInterval(function () {
    if (document.visibilityState !== "hidden") refreshHoje();
  }, 60000);
  setInterval(function () {
    if (document.visibilityState !== "hidden") { renderQuotes(); renderMarket(); }
  }, 30000);
})();
