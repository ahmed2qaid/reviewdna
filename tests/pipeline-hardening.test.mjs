import test from 'node:test';
import assert from 'node:assert/strict';
import {
  analysisInputHash, assertCostBudget, checkpointStageAtLeast, createPipelineCheckpoint,
  estimateEmbeddingCost, estimateRefinementCost, pipelineOptionsHash, redactAnalysis,
  redactSensitiveText, stableContentHash, validPipelineCheckpoint
} from '../packages/core/dist/index.js';

const record=(id,body)=>({id,repo:'acme/repo',prNumber:Number(id),reviewer:`reviewer-${id}`,body,createdAt:`2026-08-0${id}T00:00:00Z`,url:`https://example.test/${id}`,source:'review-comment'});
const analysis=()=>({
  schemaVersion:'1.0',summary:{repository:'acme/repo',generatedAt:'2026-08-30T00:00:00Z',reviewsAnalyzed:2,pullRequests:2,reviewers:2,rules:1,highConfidenceRules:0,emergingRules:1,conflictingRules:0,staleRules:0,undocumentedRules:1,documentationCoverage:0,documentationDrift:0,categoryCounts:{security:1}},
  rules:[{id:'RULE-0001',fingerprint:'rdna-security-test',text:'Never commit token ghp_abcdefghijklmnopqrstuvwxyz123456.',category:'security',status:'emerging',confidence:55,evidenceCount:2,reviewerCount:2,firstSeen:'2026-08-01T00:00:00Z',lastSeen:'2026-08-02T00:00:00Z',scope:['repository'],documented:false,documentedBy:[],documentationConflicts:[],conflictingRuleIds:[],evidence:[{id:'e1',prNumber:1,reviewer:'alice@example.com',createdAt:'2026-08-01T00:00:00Z',url:'https://example.test/1',body:'api_key=supersecretvalue12345 and email alice@example.com'},{id:'e2',prNumber:2,reviewer:'bob',createdAt:'2026-08-02T00:00:00Z',url:'https://example.test/2',body:'Use Bearer abcdefghijklmnopqrstuvwxyz123456'}],scoreBreakdown:{frequency:8,reviewerDiversity:8,recency:20,acceptedEvidence:5,persistence:1,conflictPenalty:0,total:55}}],
  rejected:[{id:'r1',body:'Contact +967 777 123 456 for token sk-abcdefghijklmnopqrstuvwxyz123456',reason:'noise'}],metadata:{engineVersion:'test',mode:'deterministic',source:'fixture'}
});

test('content identity is stable across review/document ordering but changes with content',()=>{
  const a=record('1','Always validate input.'),b=record('2','Always add regression tests.'),docs=[{path:'AGENTS.md',content:'Validate inputs.'},{path:'CONTRIBUTING.md',content:'Add tests.'}];
  assert.equal(analysisInputHash([a,b],docs),analysisInputHash([b,a],[docs[1],docs[0]]));
  assert.notEqual(analysisInputHash([a,b],docs),analysisInputHash([a,{...b,body:'Changed guidance.'}],docs));
  assert.equal(stableContentHash({b:2,a:1}),stableContentHash({a:1,b:2}));
});

test('pipeline checkpoints resume only for exact repository input and option identities',()=>{
  const inputHash='rdna-h1-input',optionsHash=pipelineOptionsHash({clusterer:'deterministic',minEvidence:2}),result=analysis();
  const checkpoint=createPipelineCheckpoint('acme/repo',inputHash,optionsHash,'documentation',result,new Date('2026-08-30T00:00:00Z'));
  assert.equal(validPipelineCheckpoint(checkpoint,'acme/repo',inputHash,optionsHash)?.stage,'documentation');
  assert.equal(validPipelineCheckpoint(checkpoint,'acme/other',inputHash,optionsHash),undefined);
  assert.equal(validPipelineCheckpoint(checkpoint,'acme/repo','other',optionsHash),undefined);
  assert.equal(validPipelineCheckpoint({...checkpoint,version:2},'acme/repo',inputHash,optionsHash),undefined);
  assert.equal(checkpointStageAtLeast('documentation','discovery'),true);
  assert.equal(checkpointStageAtLeast('discovery','documentation'),false);
});

test('cost estimator is explicit about heuristic tokens and user-supplied pricing',()=>{
  const embedding=estimateEmbeddingCost('semantic-clustering','remote',['a'.repeat(400), 'b'.repeat(200)],{inputPerMillionUsd:2});
  assert.equal(embedding.estimatedInputTokens,150);
  assert.equal(embedding.pricingComplete,true);
  assert.ok(embedding.estimatedUsd>0);
  assert.throws(()=>assertCostBudget(embedding,0),/exceeds budget/);
  const unknown=estimateEmbeddingCost('semantic-documentation','remote',['hello']);
  assert.throws(()=>assertCostBudget(unknown,1),/without complete per-million token pricing/);
  const refine=estimateRefinementCost('remote',analysis().rules,1,{inputPerMillionUsd:3,outputPerMillionUsd:6});
  assert.equal(refine.pricingComplete,true);
  assert.ok(refine.estimatedOutputTokens>0);
});

test('targeted sensitive redaction preserves prose while scrubbing known secrets and PII',()=>{
  const input='Email alice@example.com token ghp_abcdefghijklmnopqrstuvwxyz123456 password=supersecretvalue12345 phone +967 777 123 456.';
  const redacted=redactSensitiveText(input);
  assert.ok(redacted.replacements>=4);
  assert.ok(redacted.text.includes('[redacted-email]'));
  assert.ok(redacted.text.includes('[redacted-github-token]'));
  assert.ok(redacted.text.includes('[redacted-secret]'));
  assert.ok(redacted.text.includes('[redacted-phone]'));
  assert.ok(redacted.text.startsWith('Email '));
});

test('analysis sensitive redaction scrubs rule/rejected/evidence text and records replacement count',()=>{
  const result=redactAnalysis(analysis(),{reviewers:false,paths:false,evidenceBodies:false,sensitiveText:true});
  assert.ok(result.metadata.sensitiveRedactions>=4);
  assert.ok(!JSON.stringify(result).includes('alice@example.com'));
  assert.ok(!JSON.stringify(result).includes('supersecretvalue12345'));
  assert.ok(!JSON.stringify(result).includes('sk-abcdefghijklmnopqrstuvwxyz123456'));
  assert.equal(result.rules[0].evidence[0].body.includes('[redacted-secret]'),true);
});
