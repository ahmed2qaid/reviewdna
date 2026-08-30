import { readFile } from 'node:fs/promises';
import { LocalFeatureEmbeddingProvider, cosineSimilarity } from '../packages/core/dist/embeddings.js';

const rows=JSON.parse(await readFile(new URL('../benchmarks/semantic.json',import.meta.url),'utf8'));
const provider=new LocalFeatureEmbeddingProvider();
const vectors=await provider.embed(rows.map(row=>row.text));
const threshold=provider.recommendedThreshold;
let tp=0,fp=0,tn=0,fn=0,positiveSimilarity=0,positivePairs=0,negativeSimilarity=0,negativePairs=0;
for(let i=0;i<rows.length;i++)for(let j=i+1;j<rows.length;j++){
  const score=cosineSimilarity(vectors[i],vectors[j]),actual=rows[i].group===rows[j].group,predicted=score>=threshold;
  if(actual){positiveSimilarity+=score;positivePairs++;if(predicted)tp++;else fn++;}
  else{negativeSimilarity+=score;negativePairs++;if(predicted)fp++;else tn++;}
}
const precision=tp/(tp+fp||1),recall=tp/(tp+fn||1),specificity=tn/(tn+fp||1);
const result={samples:rows.length,threshold,pairs:positivePairs+negativePairs,tp,fp,tn,fn,precision:+precision.toFixed(3),recall:+recall.toFixed(3),specificity:+specificity.toFixed(3),meanPositiveSimilarity:+(positiveSimilarity/(positivePairs||1)).toFixed(3),meanNegativeSimilarity:+(negativeSimilarity/(negativePairs||1)).toFixed(3)};
console.log(JSON.stringify(result,null,2));
if(precision<.8||recall<.7||specificity<.9){console.error('Semantic benchmark quality gate failed.');process.exitCode=1;}
