import test from 'node:test';
import assert from 'node:assert/strict';
import { applyDocumentationCoverage, applySemanticDocumentationCoverage } from '../packages/core/dist/index.js';

function rule(){return {
  id:'RULE-0001',fingerprint:'rdna-api-test',text:'Validate API request input before service calls.',category:'api-design',status:'established',confidence:70,evidenceCount:2,reviewerCount:2,
  firstSeen:'2026-01-01T00:00:00Z',lastSeen:'2026-02-01T00:00:00Z',scope:['repository'],documented:false,documentedBy:[],documentationConflicts:[],conflictingRuleIds:[],
  evidence:[{id:'e1',prNumber:1,reviewer:'alice',createdAt:'2026-01-01T00:00:00Z',url:'https://example.test/1',body:'Validate API request input before service calls.'},{id:'e2',prNumber:2,reviewer:'bob',createdAt:'2026-02-01T00:00:00Z',url:'https://example.test/2',body:'Check request payloads before invoking services.'}],
  scoreBreakdown:{frequency:8,reviewerDiversity:8,recency:20,acceptedEvidence:10,persistence:2,conflictPenalty:0,total:70}
};}
function result(){return {schemaVersion:'1.0',summary:{repository:'acme/api',generatedAt:'2026-08-30T00:00:00Z',reviewsAnalyzed:2,pullRequests:2,reviewers:2,rules:1,highConfidenceRules:0,emergingRules:0,conflictingRules:0,staleRules:0,undocumentedRules:1,documentationCoverage:0,documentationDrift:0,categoryCounts:{'api-design':1}},rules:[rule()],rejected:[],metadata:{engineVersion:'test',mode:'deterministic',source:'fixture'}};}

test('lexical documentation coverage records auditable provenance',()=>{
  const analysis=result();
  applyDocumentationCoverage(analysis,[{path:'AGENTS.md',content:'Always validate API request input before service calls.'}]);
  assert.equal(analysis.rules[0].documented,true);
  assert.ok(analysis.rules[0].documentationEvidence.some(match=>match.path==='AGENTS.md'&&match.kind==='support'&&match.matcher==='lexical'));
  assert.equal(analysis.metadata.documentationMatcher,'lexical');
});

test('semantic documentation matching uses polarity even when embeddings are identical',async()=>{
  const analysis=result();
  const sources=[
    {path:'AGENTS.md',content:'Request payload checking belongs before service invocation.'},
    {path:'CONTRIBUTING.md',content:'Never validate API request input before service calls.'}
  ];
  applyDocumentationCoverage(analysis,sources);
  const provider={name:'fixture-identical-vectors',recommendedThreshold:.8,async embed(texts){return texts.map(()=>[1,0,0]);}};
  await applySemanticDocumentationCoverage(analysis,sources,provider,{threshold:.8,conflictThreshold:.8});
  assert.ok(analysis.rules[0].documentedBy.includes('AGENTS.md'));
  assert.ok(analysis.rules[0].documentationConflicts.includes('CONTRIBUTING.md'));
  assert.ok(analysis.rules[0].documentationEvidence.some(match=>match.path==='AGENTS.md'&&match.kind==='support'&&match.matcher==='semantic'&&match.score===1));
  assert.ok(analysis.rules[0].documentationEvidence.some(match=>match.path==='CONTRIBUTING.md'&&match.kind==='conflict'&&match.matcher==='semantic'&&match.score===1));
  assert.equal(analysis.metadata.documentationMatcher,'semantic');
  assert.equal(analysis.metadata.documentationEmbeddingProvider,'fixture-identical-vectors');
  assert.equal(analysis.summary.documentationDrift,1);
});

test('semantic documentation matcher batches embeddings and validates vector count',async()=>{
  const analysis=result(),sources=[{path:'AGENTS.md',content:'Request payload checking belongs before service invocation.'}];let calls=0;
  const provider={name:'batched',recommendedThreshold:.5,async embed(texts){calls++;return texts.map(()=>[1,0]);}};
  await applySemanticDocumentationCoverage(analysis,sources,provider,{threshold:.5,batchSize:1});
  assert.equal(calls,2);
  const broken={name:'broken',recommendedThreshold:.5,async embed(){return [];}};
  await assert.rejects(()=>applySemanticDocumentationCoverage(result(),sources,broken,{threshold:.5}),/returned 0 vectors/);
});
