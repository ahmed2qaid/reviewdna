import test from 'node:test';
import assert from 'node:assert/strict';
import { discoverRules } from '../packages/core/dist/index.js';
import { evidenceDisposition } from '../packages/core/dist/evidence.js';
import { applyCodeOwnerEvidence, isDirectCodeOwner, ownersForPath, parseCodeOwners } from '../packages/core/dist/codeowners.js';
import { inferAuthorReviewResponses } from '../packages/github/dist/review-signals.js';

test('evidence disposition distinguishes adoption, rejection candidates and unresolved guidance',()=>{
  const base={id:'x',repo:'a/b',prNumber:1,reviewer:'alice',body:'Always validate API payloads.',createdAt:'2026-08-20T00:00:00Z',url:'x',source:'review-comment'};
  assert.equal(evidenceDisposition({...base,accepted:true}),'accepted');
  assert.equal(evidenceDisposition({...base,changedAfterReview:true}),'adopted');
  assert.equal(evidenceDisposition({...base,resolved:true}),'acknowledged');
  assert.equal(evidenceDisposition({...base,explicitResponse:'rejected'}),'rejected-candidate');
  assert.equal(evidenceDisposition({...base,deepEvidenceChecked:true,changedAfterReview:false}),'rejected-candidate');
  assert.equal(evidenceDisposition(base),'unresolved');
});

test('explicitly rejected evidence lowers confidence more than unresolved evidence',()=>{
  const make=(signal)=>[1,2,3].map(i=>({id:`${signal}-${i}`,repo:'a/b',prNumber:i,reviewer:`r${i}`,body:'Always validate API payloads before calling services.',createdAt:`2026-08-2${i}T00:00:00Z`,url:'x',source:'review-comment',...(signal==='rejected'&&i===1?{explicitResponse:'rejected'}:{})}));
  const rejected=discoverRules(make('rejected'),'a/b','fixture').rules[0];
  const unresolved=discoverRules(make('unresolved'),'a/b','fixture').rules[0];
  assert.ok(rejected.scoreBreakdown.rejectedEvidencePenalty>0);
  assert.ok(rejected.confidence<unresolved.confidence);
  assert.equal(rejected.evidence[0].disposition,'rejected-candidate');
});

test('PR author response inference is explicit and latest matching response wins',()=>{
  const responses=inferAuthorReviewResponses([
    {id:1,body:'Please keep validation in the service.',created_at:'2026-08-20T10:00:00Z',user:{login:'reviewer'}},
    {id:2,in_reply_to_id:1,body:'This is intentional and out of scope for this PR.',created_at:'2026-08-20T10:01:00Z',user:{login:'dev'}},
    {id:3,in_reply_to_id:1,body:'Good catch, fixed and updated now.',created_at:'2026-08-20T10:02:00Z',user:{login:'dev'}},
    {id:4,in_reply_to_id:1,body:'Looks fine to me.',created_at:'2026-08-20T10:03:00Z',user:{login:'someone-else'}}
  ],'dev');
  assert.equal(responses.get(1),'accepted');
});

test('CODEOWNERS uses last matching rule and only direct user ownership boosts evidence',()=>{
  const codeowners=`* @global\n/src/** @backend @org/backend-team\n/src/security/** @security\n*.md @docs`;
  const parsed=parseCodeOwners(codeowners);
  assert.deepEqual(ownersForPath('src/security/auth.ts',parsed),['@security']);
  assert.deepEqual(ownersForPath('src/app.ts',parsed),['@backend','@org/backend-team']);
  assert.deepEqual(ownersForPath('README.md',parsed),['@docs']);
  assert.equal(isDirectCodeOwner('src/app.ts','backend',parsed),true);
  assert.equal(isDirectCodeOwner('src/app.ts','alice',parsed),false);

  const records=[
    {id:'1',repo:'a/b',prNumber:1,reviewer:'backend',body:'Always validate API payloads before calling services.',path:'src/api.ts',createdAt:'2026-08-21T00:00:00Z',url:'x',source:'review-comment'},
    {id:'2',repo:'a/b',prNumber:2,reviewer:'alice',body:'Always validate API payloads before calling services.',path:'src/users.ts',createdAt:'2026-08-22T00:00:00Z',url:'x',source:'review-comment'}
  ];
  const result=discoverRules(records,'a/b','fixture');
  const before=result.rules[0].confidence;
  applyCodeOwnerEvidence(result,{path:'.github/CODEOWNERS',content:'/src/** @backend @org/backend-team'});
  const rule=result.rules[0];
  assert.equal(rule.evidence[0].codeOwner,true);
  assert.equal(rule.evidence[1].codeOwner,false);
  assert.equal(rule.scoreBreakdown.codeOwnerEvidence,5);
  assert.equal(rule.confidence,Math.min(100,before+5));
});
