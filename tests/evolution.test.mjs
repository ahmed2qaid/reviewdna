import test from 'node:test';
import assert from 'node:assert/strict';
import { applyRuleEvolution, detectConflicts } from '../packages/core/dist/index.js';

const score=confidence=>({frequency:12,reviewerDiversity:8,recency:20,acceptedEvidence:12,persistence:4,codeOwnerEvidence:0,rejectedEvidencePenalty:0,conflictPenalty:0,total:confidence});
const evidence=(id,createdAt,disposition='acknowledged')=>({id,prNumber:Number(id.replace(/\D/g,''))||1,reviewer:`reviewer-${id}`,createdAt,url:`https://example.test/${id}`,body:'Review evidence',disposition});
const rule=(fingerprint,text,extra={})=>({
  id:fingerprint,
  fingerprint,
  text,
  category:'api-design',
  status:'established',
  confidence:70,
  evidenceCount:2,
  reviewerCount:2,
  firstSeen:'2026-01-01T00:00:00Z',
  lastSeen:'2026-01-10T00:00:00Z',
  scope:['repository'],
  documented:false,
  documentedBy:[],
  documentationConflicts:[],
  conflictingRuleIds:[],
  evidence:[evidence(`${fingerprint}-1`,'2026-01-01T00:00:00Z'),evidence(`${fingerprint}-2`,'2026-01-10T00:00:00Z','adopted')],
  scoreBreakdown:score(70),
  ...extra
});

test('rule evolution links a broader repository rule to a narrower scoped child',()=>{
  const parent=rule('parent','Validate API request input before service calls.');
  const child=rule('child','Validate API request payload input before service calls.',{scope:['src/**']});
  const summary=applyRuleEvolution([parent,child]);
  assert.equal(summary.parentRules,1);
  assert.equal(summary.childRules,1);
  assert.equal(child.relationships.parentFingerprint,'parent');
  assert.deepEqual(parent.relationships.childFingerprints,['child']);
});

test('a later opposite convention can supersede an older non-overlapping rule without active conflict penalty',()=>{
  const older=rule('old','Avoid repository access in controllers.',{
    firstSeen:'2025-01-01T00:00:00Z',lastSeen:'2025-02-01T00:00:00Z',confidence:64,scoreBreakdown:score(64),
    evidence:[evidence('old-1','2025-01-01T00:00:00Z'),evidence('old-2','2025-02-01T00:00:00Z')]
  });
  const newer=rule('new','Use repository access in controllers.',{
    firstSeen:'2026-01-01T00:00:00Z',lastSeen:'2026-02-01T00:00:00Z',confidence:72,scoreBreakdown:score(72),
    evidence:[evidence('new-1','2026-01-01T00:00:00Z'),evidence('new-2','2026-02-01T00:00:00Z','adopted')]
  });
  const summary=applyRuleEvolution([older,newer]);
  detectConflicts([older,newer]);
  assert.equal(summary.supersededRules,1);
  assert.equal(older.status,'superseded');
  assert.equal(older.relationships.supersededByFingerprint,'new');
  assert.deepEqual(newer.relationships.supersedesFingerprints,['old']);
  assert.equal(newer.scoreBreakdown.conflictPenalty,0);
  assert.equal(newer.status,'established');
  assert.equal(older.timeline.at(-1).type,'superseded');
  assert.equal(older.timeline.at(-1).relatedFingerprint,'new');
});

test('overlapping opposite conventions are not labeled superseded',()=>{
  const a=rule('a','Avoid repository access in controllers.',{
    firstSeen:'2026-01-01T00:00:00Z',lastSeen:'2026-04-01T00:00:00Z',evidence:[evidence('a-1','2026-01-01T00:00:00Z'),evidence('a-2','2026-04-01T00:00:00Z')]
  });
  const b=rule('b','Use repository access in controllers.',{
    firstSeen:'2026-03-01T00:00:00Z',lastSeen:'2026-05-01T00:00:00Z',evidence:[evidence('b-1','2026-03-01T00:00:00Z'),evidence('b-2','2026-05-01T00:00:00Z')]
  });
  const summary=applyRuleEvolution([a,b]);
  assert.equal(summary.supersededRules,0);
  assert.equal(a.relationships.supersededByFingerprint,undefined);
  assert.equal(b.relationships.supersededByFingerprint,undefined);
});

test('timeline records introduction, adoption and rejected signals in chronological order',()=>{
  const r=rule('timeline','Validate API request input before service calls.',{
    evidence:[
      evidence('t3','2026-03-01T00:00:00Z','rejected-candidate'),
      evidence('t1','2026-01-01T00:00:00Z','acknowledged'),
      evidence('t2','2026-02-01T00:00:00Z','adopted')
    ],firstSeen:'2026-01-01T00:00:00Z',lastSeen:'2026-03-01T00:00:00Z',evidenceCount:3
  });
  applyRuleEvolution([r]);
  assert.deepEqual(r.timeline.map(event=>event.type),['introduced','adopted','rejected-signal']);
  assert.deepEqual(r.evidence.map(item=>item.createdAt),['2026-01-01T00:00:00Z','2026-02-01T00:00:00Z','2026-03-01T00:00:00Z']);
});
