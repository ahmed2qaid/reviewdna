import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAnalysisInsights, redactAnalysis } from '../packages/core/dist/index.js';
import { renderHtml, renderShareSvg } from '../packages/report/dist/index.js';

const baseRule=(overrides={})=>({
  id:'RULE-1',fingerprint:'rdna-rule-1',text:'Add regression tests for behavior changes.',category:'testing',status:'established',confidence:84,evidenceCount:2,reviewerCount:2,firstSeen:'2026-08-01T00:00:00Z',lastSeen:'2026-08-02T00:00:00Z',scope:['packages/core/**'],documented:false,documentedBy:[],documentationConflicts:[],conflictingRuleIds:[],evidence:[
    {id:'e1',prNumber:1,reviewer:'alice',createdAt:'2026-08-01T00:00:00Z',url:'https://example.test/1',body:'Add a regression test.',path:'packages/core/src/a.ts'},
    {id:'e2',prNumber:2,reviewer:'bob',createdAt:'2026-08-02T00:00:00Z',url:'https://example.test/2',body:'This needs tests.',path:'packages/core/src/b.ts'}
  ],scoreBreakdown:{frequency:8,reviewerDiversity:8,recency:20,acceptedEvidence:5,persistence:1,conflictPenalty:0,total:84},...overrides
});
const analysis=()=>({schemaVersion:'1.0',summary:{repository:'acme/repo',generatedAt:'2026-08-30T00:00:00Z',reviewsAnalyzed:4,pullRequests:4,reviewers:3,rules:3,highConfidenceRules:2,emergingRules:0,conflictingRules:0,staleRules:0,undocumentedRules:3,documentationCoverage:0,documentationDrift:0,categoryCounts:{testing:1,security:1,architecture:1}},rules:[
  baseRule(),
  baseRule({id:'RULE-2',fingerprint:'rdna-rule-2',text:'Never log access tokens or credentials.',category:'security',confidence:91,scope:['apps/cli/**'],evidence:[{id:'e3',prNumber:3,reviewer:'carol',createdAt:'2026-08-03T00:00:00Z',url:'https://example.test/3',body:'Do not log tokens.',path:'apps/cli/src/auth.ts'},{id:'e4',prNumber:4,reviewer:'alice',createdAt:'2026-08-04T00:00:00Z',url:'https://example.test/4',body:'Credentials must stay out of logs.',path:'apps/cli/src/log.ts'}]}),
  baseRule({id:'RULE-3',fingerprint:'rdna-rule-3',text:'Keep domain orchestration outside transport handlers.',category:'architecture',confidence:88,scope:['apps/api/**'],humanDecision:{action:'ignore'},evidence:[{id:'e1',prNumber:1,reviewer:'alice',createdAt:'2026-08-01T00:00:00Z',url:'https://example.test/1',body:'Architecture note.',path:'packages/core/src/a.ts'}]})
],rejected:[],metadata:{engineVersion:'test',mode:'deterministic',source:'fixture'}});

test('analysis insights deduplicate evidence into useful review hotspots',()=>{
  const result=applyAnalysisInsights(analysis());
  const byPath=new Map(result.insights.reviewHotspots.map(row=>[row.path,row]));
  assert.equal(byPath.get('packages/core').evidenceCount,2);
  assert.equal(byPath.get('packages/core').ruleCount,2);
  assert.equal(byPath.get('apps/cli').evidenceCount,2);
  assert.equal(result.insights.reviewHotspots.reduce((sum,row)=>sum+row.evidenceCount,0),4);
});

test('automation opportunities are conservative, typed, and exclude ignored rules',()=>{
  const result=applyAnalysisInsights(analysis());
  const byFingerprint=new Map(result.insights.automationOpportunities.map(item=>[item.fingerprint,item]));
  assert.equal(byFingerprint.get('rdna-rule-1').kind,'test-gate');
  assert.equal(byFingerprint.get('rdna-rule-2').kind,'security-scan');
  assert.equal(byFingerprint.get('rdna-rule-2').strength,'high');
  assert.equal(byFingerprint.has('rdna-rule-3'),false);
});

test('insight paths and scopes obey the existing redaction policy',()=>{
  const result=redactAnalysis(applyAnalysisInsights(analysis()),{reviewers:false,paths:true,evidenceBodies:false,sensitiveText:false});
  assert.ok(result.insights.reviewHotspots.every(row=>row.path==='[redacted-hotspot]'));
  assert.ok(result.insights.automationOpportunities.every(item=>item.scope.every(scope=>scope==='[redacted-scope]')));
});

test('dashboard renders hotspots, automation candidates and a local share-card download',()=>{
  const html=renderHtml(applyAnalysisInsights(analysis()));
  assert.match(html,/Review Hotspots/);
  assert.match(html,/packages\/core/);
  assert.match(html,/Automation Opportunities/);
  assert.match(html,/security-scan/);
  assert.match(html,/download="reviewdna-share-card\.svg"/);
  assert.match(html,/data:image\/svg\+xml/);
});

test('share card renderer produces a standalone escaped SVG summary',()=>{
  const result=applyAnalysisInsights(analysis());
  result.summary.repository='acme/<repo>';
  const svg=renderShareSvg(result);
  assert.match(svg,/^<svg/);
  assert.match(svg,/width="1200" height="630"/);
  assert.ok(svg.includes('acme/&lt;repo&gt;'));
  assert.ok(!svg.includes('acme/<repo>'));
  assert.match(svg,/High confidence/);
});
