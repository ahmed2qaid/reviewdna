import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { classifyReview, discoverRules } from '../packages/core/dist/index.js';

test('classification rejects noise',()=>{
  const r=classifyReview({id:'x',repo:'a/b',prNumber:1,reviewer:'a',body:'LGTM',createdAt:new Date().toISOString(),url:'x',source:'review-comment'});
  assert.equal(r.noise,true);
});

test('classification recognizes reusable API rule',()=>{
  const r=classifyReview({id:'x',repo:'a/b',prNumber:1,reviewer:'a',body:'Every API endpoint must validate incoming payloads before the service layer.',createdAt:new Date().toISOString(),url:'x',source:'review-comment'});
  assert.equal(r.generalizable,true);
  assert.equal(r.category,'api-design');
});

test('discovery builds evidence-backed rules',async()=>{
  const fixture=JSON.parse(await readFile(new URL('../fixtures/reviews.json', import.meta.url),'utf8'));
  const result=discoverRules(fixture,'acme/backend','fixture');
  assert.ok(result.rules.length>=3);
  assert.ok(result.rejected.length>=2);
  assert.ok(result.rules.some(r=>r.category==='architecture'&&r.evidenceCount>=3));
  assert.ok(result.rules.some(r=>r.category==='api-design'&&r.evidenceCount>=3));
});

test('documentation coverage marks matching conventions',async()=>{
  const { applyDocumentationCoverage } = await import('../packages/core/dist/index.js');
  const fixture=JSON.parse(await readFile(new URL('../fixtures/reviews.json', import.meta.url),'utf8'));
  const result=discoverRules(fixture,'acme/backend','fixture');
  applyDocumentationCoverage(result,[{path:'AGENTS.md',content:'Database access belongs in the repository layer, not controllers.\nAlways validate API request payloads before calling services.'}]);
  assert.ok(result.rules.some(r=>r.documented));
  assert.ok(result.summary.documentationCoverage>0);
});

test('compare identifies new rules',async()=>{
  const { compareAnalysisResults } = await import('../packages/core/dist/index.js');
  const fixture=JSON.parse(await readFile(new URL('../fixtures/reviews.json', import.meta.url),'utf8'));
  const before=discoverRules(fixture.slice(0,6),'acme/backend','fixture');
  const after=discoverRules(fixture,'acme/backend','fixture');
  const delta=compareAnalysisResults(before,after);
  assert.ok(delta.newRules.some(r=>r.category==='testing'));
});

test('single review is not promoted to a convention by default',()=>{
  const result=discoverRules([{id:'one',repo:'a/b',prNumber:1,reviewer:'alice',body:'Always validate API payloads before calling the service.',createdAt:'2026-08-20T00:00:00Z',url:'x',source:'review-comment'}],'a/b','fixture');
  assert.equal(result.rules.length,0);
  assert.ok(result.rejected.some(r=>r.reason==='insufficient-evidence'));
});

test('bot review guidance is excluded by default',()=>{
  const records=[1,2].map(i=>({id:String(i),repo:'a/b',prNumber:i,reviewer:'dependabot[bot]',body:'Always update this dependency before merging.',createdAt:`2026-08-2${i}T00:00:00Z`,url:'x',source:'review-comment'}));
  const result=discoverRules(records,'a/b','fixture');
  assert.equal(result.rules.length,0);
  assert.ok(result.rejected.every(r=>r.reason==='bot'));
});

test('resolved evidence is weaker than explicit accepted evidence',()=>{
  const base=(accepted,resolved)=>[1,2].map(i=>({id:String(i),repo:'a/b',prNumber:i,reviewer:`r${i}`,body:'Always add a regression test for behavior changes.',createdAt:`2026-08-2${i}T00:00:00Z`,url:'x',accepted,resolved,source:'review-comment'}));
  const accepted=discoverRules(base(true,false),'a/b','fixture').rules[0];
  const resolved=discoverRules(base(false,true),'a/b','fixture').rules[0];
  assert.ok(accepted.scoreBreakdown.acceptedEvidence>resolved.scoreBreakdown.acceptedEvidence);
});

test('documentation drift detects opposite guidance',async()=>{
  const { applyDocumentationCoverage } = await import('../packages/core/dist/index.js');
  const records=[1,2].map(i=>({id:String(i),repo:'a/b',prNumber:i,reviewer:`r${i}`,body:'Always use axios for HTTP requests.',createdAt:`2026-08-2${i}T00:00:00Z`,url:'x',source:'review-comment'}));
  const result=discoverRules(records,'a/b','fixture');
  applyDocumentationCoverage(result,[{path:'AGENTS.md',content:'Do not use axios for HTTP requests. Prefer native fetch.'}]);
  assert.equal(result.summary.documentationDrift,1);
  assert.deepEqual(result.rules[0].documentationConflicts,['AGENTS.md']);
});

test('redaction pseudonymizes reviewers and paths without mutating source',async()=>{
  const { redactAnalysis } = await import('../packages/core/dist/index.js');
  const fixture=JSON.parse(await readFile(new URL('../fixtures/reviews.json', import.meta.url),'utf8'));
  const original=discoverRules(fixture,'acme/backend','fixture');
  const redacted=redactAnalysis(original,{reviewers:true,paths:true,evidenceBodies:true});
  assert.equal(redacted.metadata.redacted,true);
  assert.match(redacted.rules[0].evidence[0].reviewer,/^reviewer-/);
  assert.equal(redacted.rules[0].evidence[0].path,'[redacted-path]');
  assert.equal(redacted.rules[0].evidence[0].body,'[redacted review text]');
  assert.notEqual(original.rules[0].evidence[0].reviewer,redacted.rules[0].evidence[0].reviewer);
});

test('delta markdown summarizes convention changes',async()=>{
  const { compareAnalysisResults }=await import('../packages/core/dist/index.js');
  const { exportDeltaMarkdown }=await import('../packages/exporters/dist/index.js');
  const fixture=JSON.parse(await readFile(new URL('../fixtures/reviews.json',import.meta.url),'utf8'));
  const before=discoverRules(fixture.slice(0,6),'acme/backend','fixture'),after=discoverRules(fixture,'acme/backend','fixture');
  const text=exportDeltaMarkdown(compareAnalysisResults(before,after),'acme/backend');
  assert.match(text,/New conventions/);assert.match(text,/regression test/i);
});

test('compare reports lifecycle and documentation changes',async()=>{
  const { compareAnalysisResults }=await import('../packages/core/dist/index.js');
  const fixture=JSON.parse(await readFile(new URL('../fixtures/reviews.json',import.meta.url),'utf8'));
  const before=discoverRules(fixture,'acme/backend','fixture');
  const after=JSON.parse(JSON.stringify(before));
  after.rules[0].status='stale';
  after.rules[0].documented=true;
  after.rules[0].documentedBy=['AGENTS.md'];
  const delta=compareAnalysisResults(before,after);
  assert.ok(delta.changed.some(x=>x.changes.some(c=>c.startsWith('status:'))));
  assert.ok(delta.documentationChanges.some(x=>x.changes.includes('documented')));
});

test('resolved plus same-file change is stronger than resolved-only evidence',()=>{
  const make=(changed)=>[1,2].map(i=>({id:`d${i}`,repo:'a/b',prNumber:i,reviewer:`r${i}`,body:'Always validate API payloads before calling services.',createdAt:`2026-08-2${i}T00:00:00Z`,url:'x',resolved:true,changedAfterReview:changed,source:'review-comment'}));
  const deep=discoverRules(make(true),'a/b','fixture').rules[0];
  const resolved=discoverRules(make(false),'a/b','fixture').rules[0];
  assert.ok(deep.scoreBreakdown.acceptedEvidence>resolved.scoreBreakdown.acceptedEvidence);
});

test('human decisions ignore, promote and override without removing evidence',async()=>{
  const { applyHumanDecisions }=await import('../packages/core/dist/index.js');
  const { exportAgents }=await import('../packages/exporters/dist/index.js');
  const fixture=JSON.parse(await readFile(new URL('../fixtures/reviews.json',import.meta.url),'utf8'));
  const base=discoverRules(fixture,'acme/backend','fixture');
  const [first,second,third]=base.rules;
  assert.ok(first?.fingerprint&&second?.fingerprint&&third?.fingerprint);
  second.confidence=20; second.status='emerging';
  const applied=applyHumanDecisions(base,{version:1,decisions:[
    {fingerprint:first.fingerprint,action:'ignore',reason:'team rejected this convention'},
    {fingerprint:second.fingerprint,action:'promote',reason:'maintainer-approved policy'},
    {fingerprint:third.fingerprint,action:'override',overrideText:'Add regression tests for behavior changes before merge.'}
  ]});
  assert.equal(applied.summary.applied,3);
  assert.equal(applied.result.rules[0].evidence.length,base.rules[0].evidence.length);
  assert.equal(applied.result.rules[2].originalText,base.rules[2].text);
  const agents=exportAgents(applied.result);
  assert.ok(!agents.includes(first.text));
  assert.ok(agents.includes(second.text));
  assert.match(agents,/Add regression tests for behavior changes before merge/);
});

test('decision template is neutral and fingerprints are stable for the same fixture',async()=>{
  const { decisionTemplate }=await import('../packages/core/dist/index.js');
  const fixture=JSON.parse(await readFile(new URL('../fixtures/reviews.json',import.meta.url),'utf8'));
  const first=discoverRules(fixture,'acme/backend','fixture'),second=discoverRules(fixture,'acme/backend','fixture');
  assert.deepEqual(first.rules.map(r=>r.fingerprint),second.rules.map(r=>r.fingerprint));
  const template=decisionTemplate(first.rules);
  assert.ok(template.decisions.every(d=>d.action==='review'));
});

test('CONTRIBUTING suggestions include undocumented accepted rules but not ignored rules',async()=>{
  const { applyHumanDecisions }=await import('../packages/core/dist/index.js');
  const { exportContributing }=await import('../packages/exporters/dist/index.js');
  const fixture=JSON.parse(await readFile(new URL('../fixtures/reviews.json',import.meta.url),'utf8'));
  const base=discoverRules(fixture,'acme/backend','fixture');
  const ignored=base.rules[0];
  const result=applyHumanDecisions(base,{version:1,decisions:[{fingerprint:ignored.fingerprint,action:'ignore'}]}).result;
  const text=exportContributing(result);
  assert.ok(!text.includes(ignored.text));
  assert.match(text,/fingerprint: rdna-/);
});
