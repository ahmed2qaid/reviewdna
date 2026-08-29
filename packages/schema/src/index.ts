export type RuleCategory =
  | 'architecture' | 'security' | 'testing' | 'performance' | 'api-design'
  | 'naming' | 'maintainability' | 'error-handling' | 'documentation'
  | 'dependency' | 'style' | 'general';

export type RuleStatus = 'emerging' | 'established' | 'strong' | 'disputed' | 'declining' | 'stale' | 'superseded';

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
  source: 'review-comment' | 'review' | 'issue-comment';
}

export interface ClassifiedReview extends ReviewRecord {
  actionable: boolean;
  generalizable: boolean;
  category: RuleCategory;
  noise: boolean;
  oneOff: boolean;
  confidence: number;
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
}

export interface EngineeringRule {
  id: string;
  text: string;
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
  conflictingRuleIds: string[];
  evidence: RuleEvidence[];
  scoreBreakdown: {
    frequency: number;
    reviewerDiversity: number;
    recency: number;
    acceptedEvidence: number;
    persistence: number;
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
  };
}
