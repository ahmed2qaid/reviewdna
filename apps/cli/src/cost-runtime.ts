import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { assertCostBudget, formatCostEstimate, type StageCostEstimate } from '@reviewdna/core';

export interface CostTrackerOptions {
  maxRemoteCostUsd?:number;
  verbose?:boolean;
}

export class CostTracker {
  readonly estimates:StageCostEstimate[]=[];
  private remoteEstimatedUsd=0;
  constructor(private readonly options:CostTrackerOptions={}){}

  add(estimate:StageCostEstimate,remote:boolean):void{
    this.estimates.push(estimate);
    if(this.options.verbose||remote)process.stderr.write(`ReviewDNA cost preflight: ${formatCostEstimate(estimate)}\n`);
    if(!remote)return;
    const max=this.options.maxRemoteCostUsd;
    if(max===undefined)return;
    assertCostBudget(estimate,max-this.remoteEstimatedUsd);
    this.remoteEstimatedUsd+=estimate.estimatedUsd??0;
  }

  async persist(path:string):Promise<void>{
    if(!this.estimates.length)return;
    const parent=resolve(path,'..');await mkdir(parent,{recursive:true});
    const knownUsd=this.estimates.reduce((sum,item)=>sum+(item.estimatedUsd??0),0);
    await writeFile(path,JSON.stringify({version:1,generatedAt:new Date().toISOString(),estimates:this.estimates,knownEstimatedUsd:knownUsd,note:'Token counts and costs are heuristic estimates. Prices are user-supplied, not fetched from providers.'},null,2));
  }
}
