import test from "node:test";
import assert from "node:assert/strict";
import { summarizeGmgnWalletStatsEnvelope } from "../../../src/infrastructure/gmgn/wallet-stats-envelope-diagnostics.js";

const wallets=["w1","w2","w3"];
test("diagnostic counts complete record-list coverage without returning identities",()=>{
  const result=summarizeGmgnWalletStatsEnvelope({data:[{wallet:"w1"},{wallet:"w2"},{wallet:"w3"}]},wallets);
  assert.deepEqual(result,{envelopeKind:"data_record_list",requestedWalletCount:3,candidateRecordCount:3,recordsWithIdentityCount:3,requestedIdentityMatchCount:3,requestedIdentityMissingCount:0,duplicateRequestedIdentityCount:0,identitylessRecordCount:0,responseCoversAllRequestedWallets:true});
  assert.equal(JSON.stringify(result).includes("w1"),false);
});
test("diagnostic exposes a single-record response to a multi-wallet request",()=>{
  const result=summarizeGmgnWalletStatsEnvelope({wallet:"w1",realized_profit:1},wallets);
  assert.equal(result.envelopeKind,"top_level_record");
  assert.equal(result.candidateRecordCount,1);
  assert.equal(result.requestedIdentityMatchCount,1);
  assert.equal(result.requestedIdentityMissingCount,2);
  assert.equal(result.responseCoversAllRequestedWallets,false);
});
test("diagnostic counts wallet-keyed records and duplicates safely",()=>{
  const result=summarizeGmgnWalletStatsEnvelope({data:{w1:{realized_profit:1},w2:{realized_profit:2}}},wallets);
  assert.equal(result.envelopeKind,"wallet_keyed_record");
  assert.equal(result.candidateRecordCount,2);
  assert.equal(result.requestedIdentityMatchCount,0);
  assert.equal(result.identitylessRecordCount,2);
  assert.equal(result.responseCoversAllRequestedWallets,false);
});
test("diagnostic returns a fixed unrecognized shape for primitives",()=>{
  assert.deepEqual(summarizeGmgnWalletStatsEnvelope("raw",wallets),{envelopeKind:"unrecognized",requestedWalletCount:3,candidateRecordCount:0,recordsWithIdentityCount:0,requestedIdentityMatchCount:0,requestedIdentityMissingCount:3,duplicateRequestedIdentityCount:0,identitylessRecordCount:0,responseCoversAllRequestedWallets:false});
});
