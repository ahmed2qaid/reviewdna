import type { AnalysisResult, EngineeringRule } from '@reviewdna/schema';
import { similarity } from './text.js';

export interface RulePair { before: EngineeringRule; after: EngineeringRule; }
export interface AnalysisDelta {
  newRules: EngineeringRule[];
  removedRules: EngineeringRule[];
  strengthened: RulePair[];
  weakened: RulePair[];
  changed: Array<RulePair & { changes: string[] }>;
  documentationChanges: Array<RulePair & { changes: string[] }>;
}

function sameStrings(a:string[],b:string[]):boolean {
  return a.length===b.length && [...a].sort().every((v,i)=>v===[...b].sort()[i]);
}

export function compareAnalysisResults(before:AnalysisResult,after:AnalysisResult):AnalysisDelta {
  const used=new Set<string>(),pairs:RulePair[]=[];
  for(const oldRule of before.rules){
    let best:EngineeringRule|undefined,bestScore=0;
    const exact=after.rules.find(next=>!used.has(next.id)&&next.fingerprint===oldRule.fingerprint);
    if(exact){best=exact;bestScore=1;}
    for(const next of after.rules){
      if(bestScore===1||used.has(next.id)||oldRule.category!==next.category)continue;
      const score=similarity(oldRule.text,next.text);
      if(score>bestScore){best=next;bestScore=score;}
    }
    if(best&&bestScore>=.25){used.add(best.id);pairs.push({before:oldRule,after:best});}
  }
  const matchedBefore=new Set(pairs.map(p=>p.before.id));
  const changed= pairs.map(p=>{
    const changes:string[]=[];
    if(p.before.status!==p.after.status)changes.push(`status:${p.before.status}->${p.after.status}`);
    if(p.before.evidenceCount!==p.after.evidenceCount)changes.push(`evidence:${p.before.evidenceCount}->${p.after.evidenceCount}`);
    if(p.before.reviewerCount!==p.after.reviewerCount)changes.push(`reviewers:${p.before.reviewerCount}->${p.after.reviewerCount}`);
    if(!sameStrings(p.before.scope,p.after.scope))changes.push('scope');
    if((p.before.humanDecision?.action??'none')!==(p.after.humanDecision?.action??'none'))changes.push(`human-decision:${p.before.humanDecision?.action??'none'}->${p.after.humanDecision?.action??'none'}`);
    if(p.before.text!==p.after.text&&(p.before.humanDecision?.action==='override'||p.after.humanDecision?.action==='override'))changes.push('human-override-text');
    return {...p,changes};
  }).filter(p=>p.changes.length>0);
  const documentationChanges=pairs.map(p=>{
    const changes:string[]=[];
    if(p.before.documented!==p.after.documented)changes.push(p.after.documented?'documented':'undocumented');
    if(!sameStrings(p.before.documentedBy,p.after.documentedBy))changes.push('document-sources');
    if(!sameStrings(p.before.documentationConflicts,p.after.documentationConflicts))changes.push('documentation-drift');
    return {...p,changes};
  }).filter(p=>p.changes.length>0);
  return {
    newRules:after.rules.filter(r=>!used.has(r.id)),
    removedRules:before.rules.filter(r=>!matchedBefore.has(r.id)),
    strengthened:pairs.filter(p=>p.after.confidence>=p.before.confidence+8),
    weakened:pairs.filter(p=>p.after.confidence<=p.before.confidence-8),
    changed,
    documentationChanges
  };
}
