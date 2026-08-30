import type { EngineeringRule, RuleTimelineEvent } from '@reviewdna/schema';
import { conceptSimilarity, negativePolarity } from './text.js';

export interface RuleEvolutionSummary {
  parentRules: number;
  childRules: number;
  supersededRules: number;
}

function ensureRelationships(rule:EngineeringRule) {
  rule.relationships ??= {childFingerprints:[],supersedesFingerprints:[]};
  return rule.relationships;
}

function scopeSpecificity(scope:string[]):number {
  if(scope.includes('repository'))return 0;
  if(scope.some(value=>value.endsWith('/**')))return 1;
  return 2;
}

function isBroaderScope(parent:EngineeringRule,child:EngineeringRule):boolean {
  return scopeSpecificity(parent.scope)<scopeSpecificity(child.scope);
}

function relationScore(parent:EngineeringRule,child:EngineeringRule):number {
  if(parent.category!==child.category)return 0;
  if(negativePolarity(parent.text)!==negativePolarity(child.text))return 0;
  if(!isBroaderScope(parent,child))return 0;
  return conceptSimilarity(parent.text,child.text);
}

function inferParents(rules:EngineeringRule[]):void {
  for(const child of rules){
    let best:EngineeringRule|undefined,bestScore=0;
    for(const candidate of rules){
      if(candidate===child)continue;
      const score=relationScore(candidate,child);
      if(score>=.18&&score>bestScore){best=candidate;bestScore=score;}
    }
    if(!best)continue;
    ensureRelationships(child).parentFingerprint=best.fingerprint;
    const children=ensureRelationships(best).childFingerprints;
    if(!children.includes(child.fingerprint))children.push(child.fingerprint);
  }
}

function supersessionScore(older:EngineeringRule,newer:EngineeringRule):number {
  if(older.category!==newer.category)return 0;
  if(negativePolarity(older.text)===negativePolarity(newer.text))return 0;
  const olderLast=new Date(older.lastSeen).getTime(),newerFirst=new Date(newer.firstSeen).getTime();
  if(!Number.isFinite(olderLast)||!Number.isFinite(newerFirst)||newerFirst<olderLast)return 0;
  if(newer.evidenceCount<2||newer.confidence<50||newer.confidence+10<older.confidence)return 0;
  const semantic=conceptSimilarity(older.text,newer.text);
  if(semantic<.22)return 0;
  const gapDays=(newerFirst-olderLast)/86400000;
  const recencyBonus=Math.min(.08,gapDays/3650);
  return semantic+recencyBonus;
}

function inferSupersession(rules:EngineeringRule[]):void {
  for(const older of rules){
    let best:EngineeringRule|undefined,bestScore=0;
    for(const newer of rules){
      if(newer===older)continue;
      const score=supersessionScore(older,newer);
      if(score>bestScore){best=newer;bestScore=score;}
    }
    if(!best)continue;
    const oldRelationships=ensureRelationships(older),newRelationships=ensureRelationships(best);
    oldRelationships.supersededByFingerprint=best.fingerprint;
    if(!newRelationships.supersedesFingerprints.includes(older.fingerprint))newRelationships.supersedesFingerprints.push(older.fingerprint);
    older.status='superseded';
  }
}

function eventForEvidence(rule:EngineeringRule,index:number):RuleTimelineEvent {
  const evidence=rule.evidence[index]!;
  let type:RuleTimelineEvent['type']='reinforced';
  if(index===0)type='introduced';
  else if(evidence.disposition==='accepted'||evidence.disposition==='adopted')type='adopted';
  else if(evidence.disposition==='rejected-candidate')type='rejected-signal';
  return {at:evidence.createdAt,type,evidenceId:evidence.id,prNumber:evidence.prNumber};
}

function buildTimelines(rules:EngineeringRule[]):void {
  const byFingerprint=new Map(rules.map(rule=>[rule.fingerprint,rule]));
  for(const rule of rules){
    const sorted=[...rule.evidence].sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
    const original=rule.evidence;rule.evidence=sorted;
    const timeline=sorted.map((_,index)=>eventForEvidence(rule,index));
    if(!timeline.length)timeline.push({at:rule.firstSeen,type:'introduced'});
    const supersededBy=rule.relationships?.supersededByFingerprint;
    if(supersededBy){
      const replacement=byFingerprint.get(supersededBy);
      timeline.push({at:replacement?.firstSeen??rule.lastSeen,type:'superseded',relatedFingerprint:supersededBy});
    }
    timeline.sort((a,b)=>a.at.localeCompare(b.at));
    rule.timeline=timeline;
    if(original!==sorted){/* evidence is intentionally normalized chronologically for auditable timelines */}
  }
}

export function applyRuleEvolution(rules:EngineeringRule[]):RuleEvolutionSummary {
  for(const rule of rules){
    rule.relationships={childFingerprints:[],supersedesFingerprints:[]};
    rule.timeline=[];
  }
  inferParents(rules);
  inferSupersession(rules);
  buildTimelines(rules);
  return {
    parentRules:rules.filter(rule=>(rule.relationships?.childFingerprints.length??0)>0).length,
    childRules:rules.filter(rule=>Boolean(rule.relationships?.parentFingerprint)).length,
    supersededRules:rules.filter(rule=>rule.status==='superseded').length
  };
}
