import type { AnalysisResult, ClassifiedReview, EngineeringRule, ReviewRecord, RuleCategory, RuleEvidence, RuleStatus } from '@reviewdna/schema';

const NOISE = /^(lgtm|looks good|nice|thanks|thank you|done|fixed|nit:?\s*$|👍|✅)[.!\s]*$/i;
const QUESTION_ONLY = /^(why|what|how|could|can|should|is|are|do|does|did)\b.*\?$/i;
const GENERALIZERS = /\b(always|never|should|must|prefer|avoid|require|required|do not|don't|needs? to|belongs? in|use|instead of)\b/i;
const ONE_OFF = /\b(temporary|for now|this migration|this one|one[- ]off|hotfix|until we)\b/i;

const CATEGORY_PATTERNS: Array<[RuleCategory, RegExp]> = [
  ['security', /\b(secret|token|password|auth|sanitize|xss|csrf|permission|security|encrypt|credential)\b/i],
  ['testing', /\b(test|spec|coverage|regression|mock|fixture|assert)\b/i],
  ['performance', /\b(performance|n\+1|cache|memo|latency|slow|query count|allocation)\b/i],
  ['api-design', /\b(api|endpoint|status code|404|payload|request|response|schema|validation)\b/i],
  ['architecture', /\b(controller|service layer|repository layer|architecture|domain|module|boundary|dependency injection)\b/i],
  ['error-handling', /\b(error|exception|throw|catch|retry|fallback|swallow)\b/i],
  ['documentation', /\b(document|docs|readme|comment|jsdoc|docstring)\b/i],
  ['dependency', /\b(dependency|package|library|npm|module|axios|fetch)\b/i],
  ['naming', /\b(name|naming|rename|camelcase|snake_case|suffix|prefix)\b/i],
  ['maintainability', /\b(refactor|duplicate|reuse|extract|helper|maintain|complexity)\b/i],
  ['style', /\b(format|style|indent|semicolon|quote|prettier|eslint)\b/i]
];

export function normalizeReview(input: ReviewRecord): ReviewRecord {
  return {...input, body: input.body.replace(/\r\n/g, '\n').replace(/\s+/g, ' ').trim()};
}

export function classifyReview(input: ReviewRecord): ClassifiedReview {
  const review = normalizeReview(input);
  const noise = review.body.length < 4 || NOISE.test(review.body);
  const oneOff = ONE_OFF.test(review.body);
  const question = QUESTION_ONLY.test(review.body);
  const generalizable = !noise && !oneOff && (GENERALIZERS.test(review.body) || review.body.length > 55) && !question;
  const actionable = generalizable || /\b(move|add|remove|replace|rename|validate|extract|handle|return|use|avoid|don't|do not)\b/i.test(review.body);
  const category = CATEGORY_PATTERNS.find(([, pattern]) => pattern.test(review.body))?.[0] ?? 'general';
  const confidence = Math.max(0.05, Math.min(0.99,
    (noise ? 0.05 : 0.35) + (actionable ? 0.25 : 0) + (generalizable ? 0.25 : 0) - (oneOff ? 0.35 : 0) - (question ? 0.2 : 0)
  ));
  return {...review, actionable, generalizable, category, noise, oneOff, confidence};
}

function imperativeRule(text: string): string {
  let t = text.trim().replace(/^[-*]\s*/, '').replace(/^(nit|suggestion|suggestion:|please)[:\s-]*/i, '');
  t = t.replace(/\bI (?:think|would|prefer|suggest)\b[:,]?\s*/i, '');
  t = t.replace(/\bcan we\b/i, 'Prefer to');
  t = t.replace(/\bcould you\b/i, '');
  const sentences = t.split(/(?<=[.!?])\s+/).filter(Boolean);
  t = sentences.find(s => GENERALIZERS.test(s)) ?? sentences[0] ?? t;
  t = t.replace(/\?$/, '.').trim();
  if (!/[.!]$/.test(t)) t += '.';
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function tokens(text: string): Set<string> {
  const stop = new Set(['the','a','an','to','of','in','on','for','this','that','is','are','be','we','you','it','and','or','with','should','must','always','never','please','use','using','instead','like']);
  const aliases: Record<string,string> = {db:'database',query:'database',queries:'database',validated:'validate',validation:'validate',validating:'validate',repositories:'repository',controllers:'controller',payloads:'payload',endpoints:'endpoint',services:'service',tests:'test',changes:'change'};
  const raw=text.toLowerCase().replace(/[^a-z0-9_+-]+/g,' ').split(/\s+/).filter(Boolean);
  const normalized=raw.map(x=>aliases[x] ?? (x.length>5 && x.endsWith('s') && !x.endsWith('ss') ? x.slice(0,-1) : x));
  return new Set(normalized.filter(x => x.length > 2 && !stop.has(x)));
}

function similarity(a: string, b: string): number {
  const A = tokens(a), B = tokens(b);
  if (!A.size || !B.size) return 0;
  let intersection = 0;
  for (const t of A) if (B.has(t)) intersection++;
  return intersection / (A.size + B.size - intersection);
}

function scopeOf(reviews: ClassifiedReview[]): string[] {
  const dirs = reviews.map(r => r.path).filter((x): x is string => Boolean(x)).map(p => p.includes('/') ? p.split('/')[0] + '/**' : p);
  const counts = new Map<string, number>();
  for (const d of dirs) counts.set(d, (counts.get(d) ?? 0) + 1);
  const min = Math.max(2, Math.ceil(reviews.length * 0.6));
  const scopes = [...counts.entries()].filter(([,n]) => n >= min).map(([d]) => d);
  return scopes.length ? scopes : ['repository'];
}

function scoreCluster(cluster: ClassifiedReview[], now = new Date()): EngineeringRule['scoreBreakdown'] {
  const evidence = cluster.length;
  const reviewers = new Set(cluster.map(r => r.reviewer)).size;
  const dates = cluster.map(r => new Date(r.createdAt).getTime()).sort((a,b)=>a-b);
  const newest = dates.at(-1) ?? now.getTime();
  const oldest = dates[0] ?? newest;
  const ageDays = Math.max(0, (now.getTime() - newest) / 86400000);
  const spanDays = Math.max(0, (newest - oldest) / 86400000);
  const accepted = cluster.filter(r => r.accepted || r.resolved).length;
  const frequency = Math.min(30, evidence * 4);
  const reviewerDiversity = Math.min(20, reviewers * 4);
  const recency = Math.max(0, Math.round(20 - ageDays / 30));
  const acceptedEvidence = evidence ? Math.round(20 * accepted / evidence) : 0;
  const persistence = Math.min(10, Math.round(spanDays / 30));
  const conflictPenalty = 0;
  const total = Math.max(0, Math.min(100, frequency + reviewerDiversity + recency + acceptedEvidence + persistence - conflictPenalty));
  return {frequency, reviewerDiversity, recency, acceptedEvidence, persistence, conflictPenalty, total};
}

function statusFrom(score: number, lastSeen: string, firstSeen: string): RuleStatus {
  const age = (Date.now() - new Date(lastSeen).getTime()) / 86400000;
  if (age > 365) return 'stale';
  const span = (new Date(lastSeen).getTime() - new Date(firstSeen).getTime()) / 86400000;
  if (score >= 85) return 'strong';
  if (score >= 65) return 'established';
  if (span < 60) return 'emerging';
  return 'established';
}

function evidenceOf(r: ClassifiedReview): RuleEvidence {
  const e: RuleEvidence = {id:r.id, prNumber:r.prNumber, reviewer:r.reviewer, createdAt:r.createdAt, url:r.url, body:r.body};
  if (r.path !== undefined) e.path = r.path;
  if (r.accepted !== undefined) e.accepted = r.accepted;
  if (r.resolved !== undefined) e.resolved = r.resolved;
  return e;
}

export function discoverRules(records: ReviewRecord[], repository: string, source: 'github'|'fixture'='github'): AnalysisResult {
  const classified = records.map(classifyReview);
  const candidates = classified.filter(r => r.actionable && r.generalizable && !r.noise && !r.oneOff);
  const rejected = classified.filter(r => !candidates.includes(r)).map(r => ({id:r.id, body:r.body, reason:r.noise?'noise':r.oneOff?'one-off':!r.actionable?'not-actionable':'not-generalizable'}));
  const clusters: ClassifiedReview[][] = [];
  for (const review of candidates) {
    const target = clusters.find(c => c[0] && c[0].category === review.category && similarity(c[0].body, review.body) >= 0.16);
    if (target) target.push(review); else clusters.push([review]);
  }
  const rules: EngineeringRule[] = clusters.map((cluster, index) => {
    const sorted = [...cluster].sort((a,b)=>a.createdAt.localeCompare(b.createdAt));
    const score = scoreCluster(cluster);
    const firstSeen = sorted[0]?.createdAt ?? new Date().toISOString();
    const lastSeen = sorted.at(-1)?.createdAt ?? firstSeen;
    return {
      id:`RULE-${String(index+1).padStart(4,'0')}`,
      text: imperativeRule(cluster.sort((a,b)=>b.body.length-a.body.length)[0]?.body ?? ''),
      category: cluster[0]?.category ?? 'general',
      status: statusFrom(score.total, lastSeen, firstSeen),
      confidence: score.total,
      evidenceCount: cluster.length,
      reviewerCount: new Set(cluster.map(r=>r.reviewer)).size,
      firstSeen,lastSeen,
      scope: scopeOf(cluster), documented:false, documentedBy:[], conflictingRuleIds:[],
      evidence: sorted.map(evidenceOf), scoreBreakdown: score
    };
  }).sort((a,b)=>b.confidence-a.confidence);

  detectConflicts(rules);
  const prs = new Set(records.map(r=>r.prNumber));
  const reviewers = new Set(records.map(r=>r.reviewer));
  const categoryCounts: Record<string,number> = {};
  for (const rule of rules) categoryCounts[rule.category] = (categoryCounts[rule.category] ?? 0) + 1;
  const result: AnalysisResult = {
    schemaVersion:'1.0',
    summary:{repository,generatedAt:new Date().toISOString(),reviewsAnalyzed:records.length,pullRequests:prs.size,reviewers:reviewers.size,rules:rules.length,highConfidenceRules:rules.filter(r=>r.confidence>=80).length,emergingRules:rules.filter(r=>r.status==='emerging').length,conflictingRules:rules.filter(r=>r.conflictingRuleIds.length).length,staleRules:rules.filter(r=>r.status==='stale').length,undocumentedRules:rules.filter(r=>!r.documented).length,documentationCoverage:0,categoryCounts},
    rules,rejected,metadata:{engineVersion:'0.1.0',mode:'deterministic',source}
  };
  return result;
}

function oppositeSignal(text: string): {subject:string; negative:boolean} {
  const negative = /\b(avoid|never|do not|don't|remove|stop|instead of)\b/i.test(text);
  const subject = [...tokens(text)].sort().slice(0,8).join(' ');
  return {subject,negative};
}

export function detectConflicts(rules: EngineeringRule[]): void {
  for (let i=0;i<rules.length;i++) for (let j=i+1;j<rules.length;j++) {
    const a=rules[i], b=rules[j]; if(!a||!b||a.category!==b.category) continue;
    const sa=oppositeSignal(a.text), sb=oppositeSignal(b.text);
    if (sa.negative!==sb.negative && similarity(a.text,b.text)>=0.22) {
      a.conflictingRuleIds.push(b.id); b.conflictingRuleIds.push(a.id);
      a.status='disputed'; b.status='disputed';
      a.scoreBreakdown.conflictPenalty=15; b.scoreBreakdown.conflictPenalty=15;
      a.scoreBreakdown.total=Math.max(0,a.scoreBreakdown.total-15); b.scoreBreakdown.total=Math.max(0,b.scoreBreakdown.total-15);
      a.confidence=a.scoreBreakdown.total; b.confidence=b.scoreBreakdown.total;
    }
  }
}

export interface DocumentationSource { path: string; content: string; }

function documentationFragments(content: string): string[] {
  return content
    .replace(/```[\s\S]*?```/g, ' ')
    .split(/\n+|(?<=[.!?])\s+/)
    .map(line => line.replace(/^\s*[-*#>\d.)]+\s*/, '').trim())
    .filter(line => line.length >= 18 && line.length <= 600);
}

export function applyDocumentationCoverage(result: AnalysisResult, sources: DocumentationSource[]): AnalysisResult {
  for (const rule of result.rules) {
    const matches: Array<{path:string;score:number}> = [];
    for (const source of sources) {
      let best = 0;
      for (const fragment of documentationFragments(source.content)) best = Math.max(best, similarity(rule.text, fragment));
      if (best >= 0.22) matches.push({path:source.path, score:best});
    }
    rule.documentedBy = matches.sort((a,b)=>b.score-a.score).map(m=>m.path);
    rule.documented = rule.documentedBy.length > 0;
  }
  result.summary.undocumentedRules = result.rules.filter(r=>!r.documented).length;
  result.summary.documentationCoverage = result.rules.length ? Math.round(100 * (result.rules.length-result.summary.undocumentedRules) / result.rules.length) : 0;
  return result;
}

export interface AnalysisDelta {
  newRules: EngineeringRule[];
  removedRules: EngineeringRule[];
  strengthened: Array<{before:EngineeringRule;after:EngineeringRule}>;
  weakened: Array<{before:EngineeringRule;after:EngineeringRule}>;
}

export function compareAnalysisResults(before: AnalysisResult, after: AnalysisResult): AnalysisDelta {
  const used = new Set<string>();
  const pairs: Array<{before:EngineeringRule;after:EngineeringRule}> = [];
  for (const oldRule of before.rules) {
    let best: EngineeringRule | undefined;
    let bestScore = 0;
    for (const next of after.rules) {
      if (used.has(next.id) || oldRule.category !== next.category) continue;
      const score = similarity(oldRule.text, next.text);
      if (score > bestScore) { best = next; bestScore = score; }
    }
    if (best && bestScore >= 0.25) { used.add(best.id); pairs.push({before:oldRule,after:best}); }
  }
  const matchedBefore = new Set(pairs.map(p=>p.before.id));
  return {
    newRules: after.rules.filter(r=>!used.has(r.id)),
    removedRules: before.rules.filter(r=>!matchedBefore.has(r.id)),
    strengthened: pairs.filter(p=>p.after.confidence >= p.before.confidence + 8),
    weakened: pairs.filter(p=>p.after.confidence <= p.before.confidence - 8)
  };
}
