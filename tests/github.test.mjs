import test from 'node:test';
import assert from 'node:assert/strict';
import { GitHubCollector } from '../packages/github/dist/index.js';

test('incremental collection reuses unchanged pull requests',async()=>{
  const originalFetch=globalThis.fetch;const calls=[];
  globalThis.fetch=async url=>{const u=String(url);calls.push(u);if(u.includes('/pulls?state=closed'))return new Response(JSON.stringify([
    {number:1,title:'cached',html_url:'x',user:{login:'a'},merged_at:'2026-08-01T00:00:00Z',updated_at:'same'},
    {number:2,title:'changed',html_url:'x',user:{login:'b'},merged_at:'2026-08-02T00:00:00Z',updated_at:'new'}
  ]),{status:200,headers:{'content-type':'application/json'}});
  if(u.includes('/pulls/2/comments')||u.includes('/pulls/2/reviews'))return new Response('[]',{status:200,headers:{'content-type':'application/json'}});
  throw new Error(`unexpected URL ${u}`);};
  try{
    const previous={schemaVersion:1,repository:'a/b',generatedAt:'2026-08-01T00:00:00Z',prUpdatedAt:{'1':'same'},records:[{id:'old',repo:'a/b',prNumber:1,reviewer:'alice',body:'Always add tests.',createdAt:'2026-08-01T00:00:00Z',url:'x',source:'review-comment'}]};
    const result=await new GitHubCollector({maxPullRequests:2,collectThreadResolution:false}).collectWithState('a/b',previous);
    assert.equal(result.stats.cachedPullRequests,1);assert.equal(result.stats.fetchedPullRequests,1);assert.equal(result.records.length,1);assert.ok(!calls.some(x=>x.includes('/pulls/1/comments')));
  } finally {globalThis.fetch=originalFetch;}
});

test('deep evidence marks a resolved comment when its file changed after the reviewed commit', async () => {
  const originalFetch=globalThis.fetch;
  globalThis.fetch=async (url, options={}) => {
    const u=String(url);
    if(u==='https://api.github.com/graphql') return new Response(JSON.stringify({data:{repository:{pullRequest:{reviewThreads:{nodes:[{isResolved:true,comments:{nodes:[{databaseId:77}]}}]}}}}}),{status:200,headers:{'content-type':'application/json'}});
    if(u.includes('/pulls?state=closed')) return new Response(JSON.stringify([{number:7,title:'deep',html_url:'x',user:{login:'a'},merged_at:'2026-08-01T00:00:00Z',updated_at:'new',head:{sha:'headsha'}}]),{status:200,headers:{'content-type':'application/json'}});
    if(u.includes('/pulls/7/comments')) return new Response(JSON.stringify([{id:77,body:'Always validate API payloads.',html_url:'x',user:{login:'alice'},created_at:'2026-08-01T00:00:00Z',path:'src/api.ts',commit_id:'reviewsha'}]),{status:200,headers:{'content-type':'application/json'}});
    if(u.includes('/pulls/7/reviews')) return new Response('[]',{status:200,headers:{'content-type':'application/json'}});
    if(u.includes('/compare/reviewsha...headsha')) return new Response(JSON.stringify({files:[{filename:'src/api.ts'}]}),{status:200,headers:{'content-type':'application/json'}});
    throw new Error(`unexpected URL ${u}`);
  };
  try {
    const result=await new GitHubCollector({token:'test',maxPullRequests:1,deepEvidence:true}).collectWithState('a/b');
    assert.equal(result.stats.deepComparisons,1);
    assert.equal(result.records[0].resolved,true);
    assert.equal(result.records[0].changedAfterReview,true);
  } finally { globalThis.fetch=originalFetch; }
});
