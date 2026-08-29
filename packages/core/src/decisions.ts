import type { AnalysisResult, DecisionsFile, EngineeringRule, HumanDecision, RuleDecisionInput } from '@reviewdna/schema';

function clone<T>(value:T):T { return JSON.parse(JSON.stringify(value)) as T; }

export interface DecisionApplicationSummary {
  applied: number;
  ignored: number;
  promoted: number;
  overridden: number;
  unmatched: string[];
}

function validateDecision(decision:RuleDecisionInput):void {
  if(!decision.fingerprint?.trim()) throw new Error('Decision fingerprint must not be empty.');
  if(!['review','ignore','promote','override'].includes(decision.action)) throw new Error(`Unsupported decision action: ${decision.action}`);
  if(decision.action==='override'&&!decision.overrideText?.trim()) throw new Error(`Override decision ${decision.fingerprint} requires overrideText.`);
}

export function applyHumanDecisions(result:AnalysisResult,file:DecisionsFile):{result:AnalysisResult;summary:DecisionApplicationSummary} {
  if(file.version!==1||!Array.isArray(file.decisions)) throw new Error('Unsupported ReviewDNA decisions file. Expected {"version":1,"decisions":[]}.');
  const next=clone(result),byFingerprint=new Map(next.rules.map(r=>[r.fingerprint,r])),summary:DecisionApplicationSummary={applied:0,ignored:0,promoted:0,overridden:0,unmatched:[]};
  for(const decision of file.decisions){
    validateDecision(decision);
    const rule=byFingerprint.get(decision.fingerprint);
    if(!rule){summary.unmatched.push(decision.fingerprint);continue;}
    if(decision.action==='review') continue;
    const humanDecision:HumanDecision={action:decision.action};
    if(decision.reason!==undefined)humanDecision.reason=decision.reason;
    if(decision.overrideText!==undefined)humanDecision.overrideText=decision.overrideText.trim();
    rule.humanDecision=humanDecision;
    if(decision.action==='ignore')summary.ignored++;
    if(decision.action==='promote')summary.promoted++;
    if(decision.action==='override'){
      rule.originalText=rule.originalText??rule.text;
      rule.text=decision.overrideText!.trim();
      summary.overridden++;
    }
    summary.applied++;
  }
  return {result:next,summary};
}

export function decisionTemplate(rules:EngineeringRule[]):DecisionsFile {
  return {version:1,decisions:rules.map(rule=>({fingerprint:rule.fingerprint,action:'review' as const,reason:'Change action to ignore/promote/override after human review.'}))};
}
