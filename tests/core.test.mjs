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
