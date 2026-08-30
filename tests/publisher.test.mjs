import test from 'node:test';
import assert from 'node:assert/strict';
import { GitHubProposalPublisher, KNOWLEDGE_PROPOSAL_FILES, planKnowledgeProposalPublish } from '../packages/github/dist/publisher.js';

const files=KNOWLEDGE_PROPOSAL_FILES.map(name=>({name,content:`content for ${name}`}));

test('proposal publisher is a true dry-run by default',async()=>{
  const original=globalThis.fetch;
  let calls=0;
  globalThis.fetch=async()=>{calls++;throw new Error('dry-run must not call GitHub');};
  try{
    const publisher=new GitHubProposalPublisher();
    const result=await publisher.publish({repository:'acme/backend',branch:'reviewdna/proposal-demo'},files);
    assert.equal(result.applied,false);
    assert.equal(calls,0);
    assert.ok(result.files.every(path=>path.startsWith('.reviewdna/proposals/proposal-demo/')));
  }finally{globalThis.fetch=original;}
});

test('proposal publisher rejects unsafe branch and incomplete bundle before network access',()=>{
  assert.throws(()=>planKnowledgeProposalPublish({repository:'acme/backend',branch:'feature/reviewdna'},files),/must start with reviewdna\//);
  assert.throws(()=>planKnowledgeProposalPublish({repository:'acme/backend',branch:'reviewdna/demo'},files.slice(0,-1)),/incomplete/);
  assert.throws(()=>planKnowledgeProposalPublish({repository:'acme/backend',branch:'reviewdna/demo',proposalId:'../escape'},files),/unsupported characters/);
});

test('apply creates one proposal commit and PR using only proposal-prefixed paths',async()=>{
  const original=globalThis.fetch;
  const requests=[];
  globalThis.fetch=async(url,init={})=>{
    const method=init.method??'GET';
    const body=typeof init.body==='string'?JSON.parse(init.body):undefined;
    requests.push({url:String(url),method,body});
    const path=String(url);
    let status=200,payload={};
    if(path.endsWith('/repos/acme/backend'))payload={default_branch:'main'};
    else if(path.includes('/git/ref/heads/reviewdna/proposal-demo')){status=404;payload={message:'Not Found'};}
    else if(path.endsWith('/git/ref/heads/main'))payload={object:{sha:'base-sha'}};
    else if(path.endsWith('/git/commits/base-sha'))payload={sha:'base-sha',tree:{sha:'base-tree'}};
    else if(path.endsWith('/git/blobs'))payload={sha:`blob-${requests.length}`};
    else if(path.endsWith('/git/trees'))payload={sha:'proposal-tree'};
    else if(path.endsWith('/git/commits'))payload={sha:'proposal-commit'};
    else if(path.endsWith('/git/refs'))payload={ref:'refs/heads/reviewdna/proposal-demo'};
    else if(path.endsWith('/pulls'))payload={number:42,html_url:'https://github.com/acme/backend/pull/42'};
    return {ok:status>=200&&status<300,status,async json(){return payload;},async text(){return JSON.stringify(payload);}};
  };
  try{
    const publisher=new GitHubProposalPublisher('token');
    const result=await publisher.publish({repository:'acme/backend',branch:'reviewdna/proposal-demo',proposalId:'demo',apply:true},files);
    assert.equal(result.applied,true);
    assert.equal(result.pullRequestNumber,42);
    const writes=requests.filter(r=>['POST','PUT','PATCH','DELETE'].includes(r.method));
    const treeRequest=writes.find(r=>r.url.endsWith('/git/trees'));
    assert.ok(treeRequest);
    assert.ok(treeRequest.body.tree.every(entry=>entry.path.startsWith('.reviewdna/proposals/demo/')));
    assert.equal(treeRequest.body.tree.length,KNOWLEDGE_PROPOSAL_FILES.length);
    assert.equal(writes.filter(r=>r.url.endsWith('/git/commits')).length,1);
    assert.equal(writes.filter(r=>r.url.endsWith('/pulls')).length,1);
  }finally{globalThis.fetch=original;}
});
