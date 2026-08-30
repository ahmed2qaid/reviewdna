import type { ReviewRecord } from '@reviewdna/schema';
import { definePlugin, type CollectorPlugin } from '@reviewdna/plugin-sdk';

export interface GitLabCollectorOptions {
  token?: string | undefined;
  baseUrl?: string | undefined;
  maxMergeRequests?: number | undefined;
  includeSystemNotes?: boolean | undefined;
  fetchImpl?: typeof fetch | undefined;
}

interface GitLabMergeRequest {
  iid: number;
  title: string;
  web_url: string;
  merged_at?: string | null;
  updated_at: string;
  author?: { username?: string };
}

interface GitLabDiscussionNote {
  id: number;
  body?: string;
  system?: boolean;
  created_at: string;
  author?: { username?: string };
  resolvable?: boolean;
  resolved?: boolean;
  position?: {
    new_path?: string | null;
    old_path?: string | null;
  } | null;
}

interface GitLabDiscussion {
  id: string;
  notes?: GitLabDiscussionNote[];
}

function cleanBaseUrl(value: string): string {
  return value.replace(/\/+$/, '');
}

function projectId(repository: string): string {
  const trimmed = repository.trim().replace(/^\/+|\/+$/g, '');
  if (!trimmed || !trimmed.includes('/')) throw new Error('GitLab repository must be in namespace/project form.');
  return encodeURIComponent(trimmed);
}

export class GitLabCollector {
  private readonly token: string | undefined;
  private readonly baseUrl: string;
  private readonly maxMergeRequests: number;
  private readonly includeSystemNotes: boolean;
  private readonly fetchImpl: typeof fetch;

  constructor(options: GitLabCollectorOptions = {}) {
    this.token = options.token;
    this.baseUrl = cleanBaseUrl(options.baseUrl ?? 'https://gitlab.com/api/v4');
    this.maxMergeRequests = Math.max(1, options.maxMergeRequests ?? 100);
    this.includeSystemNotes = options.includeSystemNotes ?? false;
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  private headers(): Record<string, string> {
    return {
      Accept: 'application/json',
      ...(this.token ? { 'PRIVATE-TOKEN': this.token } : {})
    };
  }

  private async getResponse(url: string): Promise<Response> {
    const response = await this.fetchImpl(url, { headers: this.headers() });
    if (!response.ok) {
      const rateRemain = response.headers.get('ratelimit-remaining');
      const rateReset = response.headers.get('ratelimit-reset');
      const suffix = rateRemain === '0' ? `\nRate limit reached. Reset: ${rateReset ?? 'unknown'}` : '';
      throw new Error(`GitLab API ${response.status}: ${await response.text()}${suffix}`);
    }
    return response;
  }

  private async paged<T>(path: string, limit: number): Promise<T[]> {
    const output: T[] = [];
    let page = 1;
    while (output.length < limit) {
      const join = path.includes('?') ? '&' : '?';
      const response = await this.getResponse(`${this.baseUrl}${path}${join}per_page=100&page=${page}`);
      const batch = await response.json() as T[];
      output.push(...batch);
      const nextPage = response.headers.get('x-next-page');
      if (!nextPage && batch.length < 100) break;
      if (nextPage) page = Number(nextPage);
      else page += 1;
      if (!Number.isFinite(page) || page < 1) break;
    }
    return output.slice(0, limit);
  }

  private async mergedMergeRequests(repository: string): Promise<GitLabMergeRequest[]> {
    const id = projectId(repository);
    const items = await this.paged<GitLabMergeRequest>(
      `/projects/${id}/merge_requests?state=merged&order_by=updated_at&sort=desc`,
      this.maxMergeRequests
    );
    return items.filter(item => Boolean(item.merged_at)).slice(0, this.maxMergeRequests);
  }

  private async collectMergeRequest(repository: string, mr: GitLabMergeRequest): Promise<ReviewRecord[]> {
    const id = projectId(repository);
    const discussions = await this.paged<GitLabDiscussion>(
      `/projects/${id}/merge_requests/${mr.iid}/discussions`,
      2000
    );
    const records: ReviewRecord[] = [];
    for (const discussion of discussions) {
      for (const note of discussion.notes ?? []) {
        const body = note.body?.trim();
        if (!body) continue;
        if (note.system && !this.includeSystemNotes) continue;
        const path = note.position?.new_path ?? note.position?.old_path ?? undefined;
        const source: ReviewRecord['source'] = path ? 'review-comment' : 'issue-comment';
        const record: ReviewRecord = {
          id: `gl-note-${mr.iid}-${note.id}`,
          repo: repository,
          prNumber: mr.iid,
          prTitle: mr.title,
          ...(mr.author?.username ? { author: mr.author.username } : {}),
          reviewer: note.author?.username ?? 'unknown',
          body,
          ...(path ? { path } : {}),
          createdAt: note.created_at,
          url: `${mr.web_url}#note_${note.id}`,
          ...(note.resolvable === true ? { resolved: note.resolved === true } : {}),
          source
        };
        records.push(record);
      }
    }
    return records;
  }

  async collect(repository: string): Promise<ReviewRecord[]> {
    const merged = await this.mergedMergeRequests(repository);
    const records: ReviewRecord[] = [];
    for (const mr of merged) records.push(...await this.collectMergeRequest(repository, mr));
    return records;
  }
}

export interface GitLabCollectorPluginOptions extends GitLabCollectorOptions {}

export function createGitLabCollectorPlugin(options: GitLabCollectorPluginOptions = {}): CollectorPlugin {
  return definePlugin({
    apiVersion: '1',
    kind: 'collector',
    name: 'gitlab',
    version: '0.1.0',
    description: 'Collect merged GitLab merge-request discussions into ReviewDNA review records.',
    async collect(request) {
      const collector = new GitLabCollector({
        ...options,
        ...(request.maxItems !== undefined ? { maxMergeRequests: request.maxItems } : {})
      });
      const records = await collector.collect(request.repository);
      return {
        records,
        metadata: {
          provider: 'gitlab',
          mergeRequestsRequested: request.maxItems ?? options.maxMergeRequests ?? 100
        }
      };
    }
  });
}
