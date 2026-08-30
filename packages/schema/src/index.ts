export type RuleCategory =
  | 'architecture' | 'security' | 'testing' | 'performance' | 'api-design'
  | 'naming' | 'maintainability' | 'error-handling' | 'documentation'
  | 'dependency' | 'style' | 'general';

export type RuleStatus = 'emerging' | 'established' | 'strong' | 'disputed' | 'declining' | 'stale' | 'superseded';
export type HumanDecisionAction = 'ignore' | 'promote' | 'override';
export type EvidenceDisposition = 'accepted' | 'adopted' | 'acknowledged' | 'rejected-candidate' | 'unresolved';
export type RuleTimelineEventType = 'introduced' | 'reinforced' | 'adopted' | 'rejected-signal' | 'superseded';
export type DocumentationMatcher = 'lexical' | 'semantic';
export type DocumentationMatchKind = 'support' | 'conflict';

export interface DocumentationMatch {
  path: string;
  kind: DocumentationMatchKind;
  matcher: DocumentationMatcher;
  score: number;
}

export interface RuleTimelineEvent {
  at: string;
  type: RuleTimelineEventType;
  evidenceId?: string | undefined;
  prNumber?: number | undefined;
  relatedFingerprint?: string | undefined;
}

export interface RuleRelationships {
  parentFingerprint?: string | undefined;
  childFingerprints: string[];
  supersedesFingerprints: string[];
  supersededByFingerprint?: string | undefined;
}

export interface HumanDecision {
  action: HumanDecisionAction;
  reason?: string | undefined;
  overrideText?: string | undefined;
}

export interface RuleDecisionInput {
  fingerprint: string;
  action: HumanDecisionAction | 'review';
  reason?: string | undefined;
  overrideText?: string | undefined;
}

export interface DecisionsFile {
  version: 1;
  decisions: RuleDecisionInput[];
}

export interface KnowledgeProposalRule {
  fingerprint: string;
  text: string;
  category: RuleCategory;
  confidence: number;
  evidenceCount: number;
  scope: string[];
  humanDecision?: HumanDecision | undefined;
  evidence: Array<{
    prNumber: number;
    reviewer: string;
    createdAt: string;
    url: string;
    path?: string | undefined;
  }>;
}

export interface KnowledgeProposalManifest {
  version: 1;
  repository: string;
  generatedAt: string;
  sourceAnalysisGeneratedAt: string;
  rules: KnowledgeProposalRule[];
  counts: {
    includedRules: number;
    promotedRules: number;
    overriddenRules: number;
    evidenceLinks: number;
  };
}

export interface ReviewRecord {
  id: string;
  repo: string;
  prNumber: number;
  prTitle?: string | undefined;
  author?: string | undefined;
  reviewer: string;
  body: string;
  path?: string | undefined;
  createdAt: string;
  url: string;
  resolved?: boolean | undefined;
  accepted?: boolean | undefined;
  changedAfterReview?: boolean | undefined;
  deepEvidenceChecked?: boolean | undefined;
  explicitResponse?: 'accepted' | 'rejected' | undefined;
  source: 'review-comment' | 'review' | 'issue-comment';
}

export interface ClassifiedReview extends ReviewRecord {
  actionable: boolean;
  generalizable: boolean;
  category: RuleCategory;
  noise: boolean;
  oneOff: boolean;
  confidence: number;
  bot: boolean;
}

export interface RuleEvidence {
  id: string;
  prNumber: number;
  reviewer: string;
  createdAt: string;
  url: string;
  body: string;
  path?: string | undefined;
  accepted?: boolean | undefined;
  resolved?: boolean | undefined;
  changedAfterReview?: boolean | undefined;
  deepEvidenceChecked?: boolean | undefined;
  explicitResponse?: 'accepted' | 'rejected' | undefined;
  disposition?: EvidenceDisposition | undefined;
  codeOwner?: boolean | undefined;
}

export interface EngineeringRule {
  id: string;
  fingerprint: string;
  text: string;
  originalText?: string | undefined;
  humanDecision?: HumanDecision | undefined;
  category: RuleCategory;
  status: RuleStatus;
  confidence: number;
  evidenceCount: number;
  reviewerCount: number;
  firstSeen: string;
  lastSeen: string;
  scope: string[];
  documented: boolean;
  documentedBy: string[];
  documentationConflicts: string[];
  documentationEvidence?: DocumentationMatch[] | undefined;
  conflictingRuleIds: string[];
  relationships?: RuleRelationships | undefined;
  timeline?: RuleTimelineEvent[] | undefined;
  evidence: RuleEvidence[];
  scoreBreakdown: {
    frequency: number;
    reviewerDiversity: number;
    recency: number;
    acceptedEvidence: number;
    persistence: number;
    codeOwnerEvidence?: number | undefined;
    rejectedEvidencePenalty?: number | undefined;
    conflictPenalty: number;
    total: number;
  };
}

export interface AnalysisSummary {
  repository: string;
  generatedAt: string;
  reviewsAnalyzed: number;
  pullRequests: number;
  reviewers: number;
  rules: number;
  highConfidenceRules: number;
  emergingRules: number;
  conflictingRules: number;
  staleRules: number;
  undocumentedRules: number;
  documentationCoverage: number;
  documentationDrift: number;
  parentRules?: number | undefined;
  childRules?: number | undefined;
  supersededRules?: number | undefined;
  categoryCounts: Record<string, number>;
}

export interface AnalysisResult {
  schemaVersion: '1.0';
  summary: AnalysisSummary;
  rules: EngineeringRule[];
  rejected: Array<{id:string; body:string; reason:string}>;
  metadata: {
    engineVersion: string;
    mode: 'deterministic' | 'hybrid' | 'llm';
    source: 'github' | 'fixture';
    redacted?: boolean | undefined;
    provider?: string | undefined;
    refinedRules?: number | undefined;
    clusterer?: 'deterministic' | 'semantic' | undefined;
    embeddingProvider?: string | undefined;
    semanticThreshold?: number | undefined;
    evolutionModel?: string | undefined;
    documentationMatcher?: 'lexical' | 'semantic' | undefined;
    documentationEmbeddingProvider?: string | undefined;
    documentationSemanticThreshold?: number | undefined;
  };
}
