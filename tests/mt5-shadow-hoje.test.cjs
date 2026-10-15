"use strict";
// Teste local do card FX sem API externa, chave ou ordens.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const read = name => fs.readFileSync(path.join(__dirname, "..", name), "utf8");
const html = read("index.html"), source = read("mt5-shadow-hoje.js");
assert.ok(html.includes('mt5-shadow-hoje.js') && html.includes('mt5-shadow-hoje.css'));
assert.ok(!source.includes("live_market_minute") && !source.includes("RISKDESK_SUPABASE_SECRET_KEY"));
assert.doesNotThrow(() => new vm.Script(source));

async function scenario(rows) {
  const elements = {};
  function makeElement() {
    let inner = "";
    const node = { textContent: "", className: "", children: [],
      append(...children) { this.children.push(...children); },
      appendChild(child) { this.children.push(child); },
      insertBefore(child) { this.children.push(child); },
      querySelector(name) { return name === ".product-events" ? {} : null; },
    };
    Object.defineProperty(node, "innerHTML", {
      get() { return inner; },
      set(value) {
        inner = value;
        if (value.includes('id="rdMt5Status"')) {
          ["rdMt5Pairs", "rdMt5Status", "rdMt5Time"].forEach(id => elements[id] = makeElement());
        }
      }
    });
    return node;
  }
  elements.hoje = makeElement();
  const doc = { visibilityState: "visible", getElementById: id => elements[id] || null,
    createElement: () => makeElement() };
  const calls = [];
  const ctx = { document: doc, setInterval(fn, ms) { calls.push(ms); },
    api: async (table, query) => {
      assert.equal(table, "riskdesk_mt5_fx_shadow");
      assert.ok(query.includes("select=symbol,mid,as_of_utc,quality_status,source"));
      return rows;
    }, Date, Intl };
  vm.runInNewContext(source,ctx);
  await new Promise(done => setTimeout(done, 15));
  assert.equal(elements.hoje.children.length, 1);
  assert.equal(elements.rdMt5Pairs.children.length, 7);
  assert.deepEqual(calls,[15000,5000]);
  return elements;
}
(async () => {
  const empty = await scenario([]);
  assert.equal(empty.rdMt5Status.textContent, "AGUARDANDO COLETA");
  assert.ok(empty.rdMt5Time.textContent.includes("nenhum valor ficticio"));
  const symbols = ["DXY_SYNTH","EURUSD","USDJPY","GBPUSD","USDCAD","USDSEK","USDCHF"];
  const stamp = new Date().toISOString();
  const rows = symbols.map(symbol => ({symbol,source:"MT5_ACTIVTRADES_SHADOW",
    mid:symbol==="DXY_SYNTH"?102.2:1.2,as_of_utc:stamp,quality_status:"RECENT"}));
  const good = await scenario(rows);
  assert.equal(good.rdMt5Status.textContent,"COTACOES RECENTES · SHADOW");
  assert.ok(good.rdMt5Pairs.children[0].children[1].textContent.includes("102,2"));
  const stale = await scenario(rows.map((row,i) => i===3 ? {...row,quality_status:"STALE"} : row));
  assert.equal(stale.rdMt5Status.textContent, "DADOS PARCIAIS / ANTIGOS");
  assert.ok(stale.rdMt5Pairs.children[3].children[2].textContent.includes("Atrasado"));
  console.log("PASS: MT5 shadow vazio/recente/stale, 7 ativos, polling isolado");
})().catch(error => { console.error(error); process.exitCode = 1; });
