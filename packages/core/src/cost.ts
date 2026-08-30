import type { EngineeringRule } from '@reviewdna/schema';

export interface StagePricing {
  inputPerMillionUsd?: number | undefined;
  outputPerMillionUsd?: number | undefined;
}

export interface StageCostEstimate {
  stage: 'semantic-clustering' | 'semantic-documentation' | 'wording-refinement';
  provider: string;
  inputItems: number;
  estimatedInputTokens: number;
  estimatedOutputTokens: number;
  estimatedUsd?: number | undefined;
  pricingComplete: boolean;
  approximation: 'heuristic';
}

export function estimateTextTokens(text:string):number{
  if(!text)return 0;
  const words=text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1,Math.ceil(Math.max(text.length/4,words*1.3)));
}

export function estimateEmbeddingCost(stage:'semantic-clustering'|'semantic-documentation',provider:string,texts:string[],pricing:StagePricing={}):StageCostEstimate{
  const estimatedInputTokens=texts.reduce((sum,text)=>sum+estimateTextTokens(text),0),price=pricing.inputPerMillionUsd;
  return{
    stage,provider,inputItems:texts.length,estimatedInputTokens,estimatedOutputTokens:0,
    ...(price!==undefined?{estimatedUsd:estimatedInputTokens/1_000_000*price}:{}),
    pricingComplete:price!==undefined,approximation:'heuristic'
  };
}

export function estimateRefinementCost(provider:string,rules:EngineeringRule[],maxRules:number,pricing:StagePricing={}):StageCostEstimate{
  const selected=rules.slice(0,Math.max(0,maxRules));
  let estimatedInputTokens=0,estimatedOutputTokens=0;
  for(const rule of selected){
    const evidence=rule.evidence.slice(0,8).map(item=>item.body).join('\n');
    estimatedInputTokens+=estimateTextTokens(`${rule.text}\n${rule.category}\n${rule.scope.join(', ')}\n${evidence}`)+80;
    estimatedOutputTokens+=Math.max(20,Math.min(100,estimateTextTokens(rule.text)+20));
  }
  const inputPrice=pricing.inputPerMillionUsd,outputPrice=pricing.outputPerMillionUsd,pricingComplete=inputPrice!==undefined&&outputPrice!==undefined;
  const estimatedUsd=pricingComplete?(estimatedInputTokens/1_000_000*inputPrice!)+(estimatedOutputTokens/1_000_000*outputPrice!):undefined;
  return{
    stage:'wording-refinement',provider,inputItems:selected.length,estimatedInputTokens,estimatedOutputTokens,
    ...(estimatedUsd!==undefined?{estimatedUsd}:{}),pricingComplete,approximation:'heuristic'
  };
}

export function assertCostBudget(estimate:StageCostEstimate,maxUsd:number|undefined):void{
  if(maxUsd===undefined)return;
  if(!Number.isFinite(maxUsd)||maxUsd<0)throw new Error('--max-remote-cost-usd must be a non-negative number.');
  if(!estimate.pricingComplete||estimate.estimatedUsd===undefined)throw new Error(`Cannot enforce a remote cost budget for ${estimate.stage} without complete per-million token pricing.`);
  if(estimate.estimatedUsd>maxUsd)throw new Error(`Estimated ${estimate.stage} cost $${estimate.estimatedUsd.toFixed(6)} exceeds budget $${maxUsd.toFixed(6)}.`);
}

export function formatCostEstimate(estimate:StageCostEstimate):string{
  const cost=estimate.estimatedUsd===undefined?'price not configured':`~$${estimate.estimatedUsd.toFixed(6)}`;
  return `${estimate.stage}: ${estimate.inputItems} items, ~${estimate.estimatedInputTokens} input tokens${estimate.estimatedOutputTokens?`, ~${estimate.estimatedOutputTokens} output tokens`:''}, ${cost} (${estimate.provider}, heuristic estimate)`;
}
