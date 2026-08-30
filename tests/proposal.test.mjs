import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { applyHumanDecisions, discoverRules } from '../packages/core/dist/index.js';
import { buildKnowledgeProposalManifest, exportKnowledgeProposal } from '../packages/exporters/dist/index.js';

test('knowledge proposal includes approved policy rules and preserves evidence provenance',async()=>{
  const fixture=JSON.parse(await readFile(new URL('../fixtures/reviews.json',import.meta.url),'utf8'));
  const base=discoverRules(fixture,'acme/backend','fixture');
  const [ignored,promoted]=base.rules;
  assert.ok(ignored&&promoted);
  promoted.confidence=10;
  promoted.status='emerging';
  const decided=applyHumanDecisions(base,{version:1,decisions:[
    {fingerprint:ignored.fingerprint,action:'ignore'},
    {fingerprint:promoted.fingerprint,action:'promote',reason:'team policy'}
  ]}).result;
  const manifest=buildKnowledgeProposalManifest(decided);
  assert.ok(!manifest.rules.some(r=>r.fingerprint===ignored.fingerprint));
  assert.ok(manifest.rules.some(r=>r.fingerprint===promoted.fingerprint));
  assert.ok(manifest.rules.every(r=>r.evidence.every(e=>e.url)));
  assert.equal(manifest.counts.evidenceLinks,manifest.rules.reduce((sum,r)=>sum+r.evidence.length,0));
  const markdown=exportKnowledgeProposal(decided);
  assert.match(markdown,/proposal, not an automatic policy update/i);
  assert.match(markdown,/PR #/);
});
