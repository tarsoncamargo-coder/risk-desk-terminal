"use strict";
const assert=require("node:assert/strict");
const Core=require("../options-core.js");

const gold=[
  "Gold (OG|GC) G3RV6 (0.84 DTE) vs 4127.3 (-50.0, Range: 90.0) at 23.64% Volatility",
  "Volatility\tDelta\tCall Settle\tCall\tStrike\tPut\tPut Settle\tDelta\tStraddle\tGamma\tVega\tTheta",
  "24.27\t0.72\t82.8\t35.8\t4100\t8.5\t5.5\t-0.28\t44.3\t0.007\t0.669\t-8.479",
  "24.05\t0.52\t62.3\t20.2\t4125\t17.9\t10.1\t-0.48\t38.0\t0.008\t0.789\t-17.861",
  "23.77\t0.32\t44.5\t9.6\t4150\t32.3\t17.2\t-0.68\t41.9\t0.008\t0.705\t-9.609",
  "Strike\tG3RV6\t1 DTE\tOG3V6\t2 DTE",
  "C\tP\tC\tP",
  "4100\t50\t400\t10\t20",
  "4125\t100\t150\t30\t40",
  "4150\t300\t80\t20\t10"
].join("\n");

const r=Core.computeFromText(gold,"MGC");
assert.equal(r.asset,"MGC");
assert.equal(r.series,"G3RV6");
assert.equal(r.referencePrice,4127.3);
assert.equal(r.atmStrike,4125);
assert.equal(r.atmIvPct,24.05);
assert.equal(r.cwC,4150);
assert.equal(r.cwCallOi,300);
assert.equal(r.pwC,4100);
assert.equal(r.pwPutOi,400);
const expected=4127.3*0.2405*Math.sqrt(0.84/365);
assert.ok(Math.abs(r.dp1-expected)<1e-9);
assert.ok(Number.isFinite(r.callGex));
assert.ok(Number.isFinite(r.putGex));
assert.ok(Number.isFinite(r.netGex));
assert.equal(r.dataStatus,"PARCIAL");
assert.equal(Core.ASSETS.MGC.multiplier,100);
assert.equal(Core.ASSETS.MNQ.multiplier,20);
assert.equal(Core.roundToTick(30975.83,0.25),30975.75);

const payload=Core.snapshotPayload(r,"TEST","2026-10-15T00:00:00Z");
assert.equal(payload.asset,"MGC");
assert.equal(payload.source_mode,"TEST");
assert.equal(payload.reference_price,4127.3);
assert.equal(payload.dte_days,0.84);
assert.equal(payload.dte_minutes,1209.6);
assert.equal(payload.cw_c,4150);
assert.equal(payload.pw_c,4100);
assert.equal(payload.quality.atmCallDelta,0.52);
assert.equal(payload.quality.cwCallOi,300);
assert.equal(payload.quality.pwPutOi,400);
assert.ok(Array.isArray(payload.quality.warnings));
console.log("PASS OPTIONS V1: parser, ATM IV, DP, walls, GEX and snapshot payload");
