import type { ReviewRecord } from '@reviewdna/schema';

export interface GitHubCollectorOptions { token?: string | undefined; maxPullRequests?: number | undefined; includeIssueComments?: boolean | undefined; collectThreadResolution?: boolean | undefined; }
interface GitHubPR { number:number; title:string; html_url:string; user?:{login?:string}; merged_at?:string|null; }
interface GHReviewComment { id:number; body?:string; html_url:string; user?:{login?:string}; created_at:string; path?:string; pull_request_url?:string; }
interface GHIssueComment { id:number; body?:string; html_url:string; user?:{login?:string}; created_at:string; }
interface GHReview { id:number; body?:string; html_url:string; user?:{login?:string}; submitted_at?:string; state?:string; }

export class GitHubCollector {
  private readonly token: string | undefined;
  private readonly maxPullRequests: number;
  private readonly includeIssueComments: boolean;
  private readonly collectThreadResolution: boolean;
  constructor(options:GitHubCollectorOptions={}) { this.token=options.token; this.maxPullRequests=options.maxPullRequests ?? 100; this.includeIssueComments=options.includeIssueComments ?? false; this.collectThreadResolution=options.collectThreadResolution ?? true; }
  private headers(){ return {Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',...(this.token?{Authorization:`Bearer ${this.token}`}:{})}; }
  private async get<T>(url:string):Promise<T>{
    const res=await fetch(url,{headers:this.headers()});
    if(!res.ok){ const remain=res.headers.get('x-ratelimit-remaining'); const reset=res.headers.get('x-ratelimit-reset'); throw new Error(`GitHub API ${res.status}: ${await res.text()}${remain==='0'?`\nRate limit reached. Reset epoch: ${reset}`:''}`); }
    return res.json() as Promise<T>;
  }
  private async graphql<T>(query:string, variables:Record<string,unknown>):Promise<T>{
    if(!this.token) throw new Error('GitHub GraphQL requires GITHUB_TOKEN.');
    const res=await fetch('https://api.github.com/graphql',{method:'POST',headers:{'content-type':'application/json',Authorization:`Bearer ${this.token}`},body:JSON.stringify({query,variables})});
    if(!res.ok) throw new Error(`GitHub GraphQL ${res.status}: ${await res.text()}`);
    const json=await res.json() as {data?:T;errors?:Array<{message:string}>};
    if(json.errors?.length) throw new Error(`GitHub GraphQL: ${json.errors.map(e=>e.message).join('; ')}`);
    if(!json.data) throw new Error('GitHub GraphQL returned no data.');
    return json.data;
  }
  private async resolvedCommentIds(owner:string,repo:string,number:number):Promise<Set<number>>{
    if(!this.token || !this.collectThreadResolution) return new Set();
    type ThreadData={repository:{pullRequest:{reviewThreads:{nodes:Array<{isResolved:boolean;comments:{nodes:Array<{databaseId:number|null}>}}>}|null}|null}|null};
    const query=`query($owner:String!,$repo:String!,$number:Int!){repository(owner:$owner,name:$repo){pullRequest(number:$number){reviewThreads(first:100){nodes{isResolved comments(first:50){nodes{databaseId}}}}}}}`;
    const data=await this.graphql<ThreadData>(query,{owner,repo,number});
    const ids=new Set<number>();
    for(const thread of data.repository?.pullRequest?.reviewThreads?.nodes??[]) if(thread.isResolved) for(const c of thread.comments.nodes) if(c.databaseId) ids.add(c.databaseId);
    return ids;
  }
  async collectDocumentation(repository:string):Promise<Array<{path:string;content:string}>>{
    const [owner,repo]=repository.split('/'); if(!owner||!repo) throw new Error('Repository must be in owner/name form.');
    const paths=['AGENTS.md','CLAUDE.md','CONTRIBUTING.md','.github/copilot-instructions.md','.cursorrules','.cursor/rules/repository.mdc'];
    const out:Array<{path:string;content:string}>=[];
    for(const path of paths){
      try{
        const data=await this.get<{type:string;content?:string;encoding?:string}>(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`);
        if(data.type==='file'&&data.content&&data.encoding==='base64'){
          const bytes=Uint8Array.from(atob(data.content.replace(/\n/g,'')),c=>c.charCodeAt(0));
          out.push({path,content:new TextDecoder().decode(bytes)});
        }
      }catch(err){ if(!(err instanceof Error)||!err.message.includes('404')) throw err; }
    }
    return out;
  }
  private async paged<T>(url:string, limit=1000):Promise<T[]> {
    const out:T[]=[];
    for(let page=1; out.length<limit; page++){
      const join=url.includes('?')?'&':'?'; const batch=await this.get<T[]>(`${url}${join}per_page=100&page=${page}`); out.push(...batch); if(batch.length<100)break;
    }
    return out.slice(0,limit);
  }
  async collect(repository:string):Promise<ReviewRecord[]> {
    const [owner,repo]=repository.split('/'); if(!owner||!repo) throw new Error('Repository must be in owner/name form.');
    const pulls=await this.paged<GitHubPR>(`https://api.github.com/repos/${owner}/${repo}/pulls?state=closed&sort=updated&direction=desc`,this.maxPullRequests);
    const merged=pulls.filter(p=>p.merged_at).slice(0,this.maxPullRequests);
    const records:ReviewRecord[]=[];
    let position=0;
    for(const pr of merged){
      position++; process.stderr.write(`\rCollecting reviews ${position}/${merged.length} (PR #${pr.number})`);
      const [comments,reviews,issueComments,resolvedIds]=await Promise.all([
        this.paged<GHReviewComment>(`https://api.github.com/repos/${owner}/${repo}/pulls/${pr.number}/comments`,500),
        this.paged<GHReview>(`https://api.github.com/repos/${owner}/${repo}/pulls/${pr.number}/reviews`,200),
        this.includeIssueComments?this.paged<GHIssueComment>(`https://api.github.com/repos/${owner}/${repo}/issues/${pr.number}/comments`,300):Promise.resolve([] as GHIssueComment[]),
        this.resolvedCommentIds(owner,repo,pr.number).catch(()=>new Set<number>())
      ]);
      for(const c of comments) if(c.body?.trim()) records.push({id:`rc-${c.id}`,repo:repository,prNumber:pr.number,prTitle:pr.title,author:pr.user?.login,reviewer:c.user?.login??'unknown',body:c.body,path:c.path,createdAt:c.created_at,url:c.html_url,resolved:resolvedIds.has(c.id),source:'review-comment'});
      for(const r of reviews) if(r.body?.trim()) records.push({id:`rv-${r.id}`,repo:repository,prNumber:pr.number,prTitle:pr.title,author:pr.user?.login,reviewer:r.user?.login??'unknown',body:r.body,createdAt:r.submitted_at??new Date().toISOString(),url:r.html_url,accepted:r.state==='APPROVED',source:'review'});
      for(const c of issueComments) if(c.body?.trim()) records.push({id:`ic-${c.id}`,repo:repository,prNumber:pr.number,prTitle:pr.title,author:pr.user?.login,reviewer:c.user?.login??'unknown',body:c.body,createdAt:c.created_at,url:c.html_url,source:'issue-comment'});
    }
    process.stderr.write('\n'); return records;
  }
}
