import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyReview } from '../packages/core/dist/index.js';
import { LocalFeatureEmbeddingProvider, cosineSimilarity } from '../packages/core/dist/embeddings.js';
import { discoverRulesSemantic, semanticClusters } from '../packages/core/dist/semantic.js';
import { OllamaEmbeddingProvider, OpenAICompatibleEmbeddingProvider } from '../packages/providers/dist/index.js';

const record=(id,body,extra={})=>({id,repo:'acme/backend',prNumber:Number(id.replace(/\D/g,''))||1,reviewer:`reviewer-${id}`,body,createdAt:'2026-08-20T00:00:00Z',url:`https://example.test/${id}`,source:'review-comment',...extra});

test('semantic clustering merges high-similarity paraphrases but respects polarity',async()=>{
  const reviews=[
    classifyReview(record('1','Database access should stay in the repository layer instead of controllers.')),
    classifyReview(record('2','Persistence operations should remain behind the data access layer, away from HTTP handlers.')),
    classifyReview(record('3','Database access should never stay in the repository layer.'))
  ];
  const vectors=new Map([
    [reviews[0].body,[1,0,0]],
    [reviews[1].body,[.99,.01,0]],
    [reviews[2].body,[1,0,0]]
  ]);
  const provider={name:'fixture-embedding',recommendedThreshold:.8,async embed(texts){return texts.map(text=>vectors.get(text));}};
  const result=await semanticClusters(reviews,provider,{threshold:.8});
  assert.equal(result.clusters.length,2);
  assert.ok(result.clusters.some(cluster=>cluster.length===2));
  assert.ok(result.clusters.some(cluster=>cluster.length===1&&cluster[0].id==='3'));
});

test('semantic discovery reuses the normal evidence/confidence pipeline',async()=>{
  const records=[
    record('1','Database access should stay in the repository layer instead of controllers.'),
    record('2','Persistence operations should remain behind the data access layer, away from HTTP handlers.')
  ];
  const provider={name:'fixture-embedding',recommendedThreshold:.8,async embed(){return [[1,0,0],[.99,.01,0]];}};
  const result=await discoverRulesSemantic(records,'acme/backend','fixture',provider,{minEvidence:2,threshold:.8});
  assert.equal(result.rules.length,1);
  assert.equal(result.rules[0].evidenceCount,2);
  assert.equal(result.metadata.clusterer,'semantic');
  assert.equal(result.metadata.embeddingProvider,'fixture-embedding');
  assert.equal(result.metadata.semanticThreshold,.8);
});

test('local feature embeddings recognize common engineering paraphrases',async()=>{
  const provider=new LocalFeatureEmbeddingProvider();
  const [a,b,c]=await provider.embed([
    'Database queries should live in the repository layer, not controllers.',
    'Keep persistence access behind the data access layer and away from HTTP handlers.',
    'Every API request payload must be validated before service invocation.'
  ]);
  assert.ok(cosineSimilarity(a,b)>=provider.recommendedThreshold);
  assert.ok(cosineSimilarity(a,b)>cosineSimilarity(a,c));
});

test('Ollama embedding provider batches input through api/embed',async()=>{
  const original=globalThis.fetch;let captured;
  globalThis.fetch=async(url,init)=>{captured={url:String(url),body:JSON.parse(init.body)};return new Response(JSON.stringify({embeddings:[[1,0],[0,1]]}),{status:200,headers:{'content-type':'application/json'}});};
  try{
    const provider=new OllamaEmbeddingProvider('nomic-embed-text','http://localhost:11434');
    const vectors=await provider.embed(['one','two']);
    assert.equal(captured.url,'http://localhost:11434/api/embed');
    assert.deepEqual(captured.body.input,['one','two']);
    assert.equal(vectors.length,2);
  }finally{globalThis.fetch=original;}
});

test('OpenAI-compatible embedding provider restores response index order',async()=>{
  const original=globalThis.fetch;
  globalThis.fetch=async()=>new Response(JSON.stringify({data:[{index:1,embedding:[0,1]},{index:0,embedding:[1,0]}]}),{status:200,headers:{'content-type':'application/json'}});
  try{
    const provider=new OpenAICompatibleEmbeddingProvider({baseUrl:'https://provider.test/v1',apiKey:'test',model:'embed-model'});
    assert.deepEqual(await provider.embed(['a','b']),[[1,0],[0,1]]);
  }finally{globalThis.fetch=original;}
});
