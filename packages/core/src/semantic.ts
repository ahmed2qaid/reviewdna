import type { AnalysisResult, ClassifiedReview, ReviewRecord } from '@reviewdna/schema';
import { buildAnalysisFromClusters, prepareDiscovery, type DiscoveryOptions } from './discovery.js';
import { cosineSimilarity, meanEmbedding, type EmbeddingProvider } from './embeddings.js';
import { negativePolarity } from './text.js';

export interface SemanticDiscoveryOptions extends DiscoveryOptions {
  threshold?: number;
  completeLinkSlack?: number;
}

interface SemanticCluster {
  reviews: ClassifiedReview[];
  vectors: number[][];
  centroid: number[];
  category: ClassifiedReview['category'];
  negative: boolean;
}

function validateEmbeddings(vectors:number[][],count:number){
  if(vectors.length!==count)throw new Error(`Embedding provider returned ${vectors.length} vectors for ${count} texts.`);
  const dimensions=vectors[0]?.length??0;
  if(!dimensions)throw new Error('Embedding provider returned empty vectors.');
  for(const vector of vectors){
    if(vector.length!==dimensions)throw new Error('Embedding provider returned inconsistent vector dimensions.');
    if(vector.some(value=>!Number.isFinite(value)))throw new Error('Embedding provider returned a non-finite value.');
  }
}

export async function semanticClusters(candidates:ClassifiedReview[],provider:EmbeddingProvider,options:SemanticDiscoveryOptions={}):Promise<{clusters:ClassifiedReview[][];threshold:number}>{
  if(!candidates.length)return{clusters:[],threshold:options.threshold??provider.recommendedThreshold??.78};
  const threshold=options.threshold??provider.recommendedThreshold??.78;
  if(!Number.isFinite(threshold)||threshold<=0||threshold>1)throw new Error('Semantic threshold must be > 0 and <= 1.');
  const slack=options.completeLinkSlack??.12;
  if(!Number.isFinite(slack)||slack<0||slack>=1)throw new Error('Complete-link slack must be >= 0 and < 1.');
  const floor=Math.max(0,threshold-slack);
  const ordered=[...candidates].sort((a,b)=>`${a.category}:${negativePolarity(a.body)?1:0}:${a.id}`.localeCompare(`${b.category}:${negativePolarity(b.body)?1:0}:${b.id}`));
  const vectors=await provider.embed(ordered.map(review=>review.body));
  validateEmbeddings(vectors,ordered.length);
  const clusters:SemanticCluster[]=[];
  for(let index=0;index<ordered.length;index++){
    const review=ordered[index]!,vector=vectors[index]!,negative=negativePolarity(review.body);
    let best:SemanticCluster|undefined,bestScore=-1;
    for(const cluster of clusters){
      if(cluster.category!==review.category||cluster.negative!==negative)continue;
      const centroidScore=cosineSimilarity(vector,cluster.centroid);
      if(centroidScore<threshold||centroidScore<=bestScore)continue;
      let minPair=1;
      for(const existing of cluster.vectors)minPair=Math.min(minPair,cosineSimilarity(vector,existing));
      if(minPair<floor)continue;
      best=cluster;bestScore=centroidScore;
    }
    if(best){best.reviews.push(review);best.vectors.push(vector);best.centroid=meanEmbedding(best.vectors);}
    else clusters.push({reviews:[review],vectors:[vector],centroid:vector,category:review.category,negative});
  }
  return{clusters:clusters.map(cluster=>cluster.reviews),threshold};
}

export async function discoverRulesSemantic(records:ReviewRecord[],repository:string,source:'github'|'fixture',provider:EmbeddingProvider,options:SemanticDiscoveryOptions={}):Promise<AnalysisResult>{
  const prepared=prepareDiscovery(records,options),semantic=await semanticClusters(prepared.candidates,provider,options);
  return buildAnalysisFromClusters(records,repository,source,semantic.clusters,prepared.rejected,options,{clusterer:'semantic',embeddingProvider:provider.name,semanticThreshold:semantic.threshold});
}
