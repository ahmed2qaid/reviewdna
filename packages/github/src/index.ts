import type { ReviewRecord } from '@reviewdna/schema';
import { inferAuthorReviewResponses } from './review-signals.js';

export interface GitHubCollectorOptions {
  token?: string | undefined;
  maxPullRequests?: number | undefined;
  includeIssueComments?: boolean | undefined;
  collectThreadResolution?: boolean | undefined;
  deepEvidence?: boolean | undefined;
  maxDeepComparisonsPerPullRequest?: number | undefined;
}
export interface GitHubCollectionState { schemaVersion:1|2; repository:string; generatedAt:string; prUpdatedAt:Record<string,string>; records:ReviewRecord[]; }
export interface GitHubCollectionResult { records:ReviewRecord[]; state:GitHubCollectionState; stats:{pullRequests:number;fetchedPullRequests:number;cachedPullRequests:number;deepComparisons:number}; }
interface GitHubPR { number:number; title:string; html_url:string; user?:{login?:string}; merged_at?:string|null; updated_at:string; head?:{sha?:string}; }
interface GHReviewComment { id:number; body?:string; html_url:string; user?:{login?:string}; created_at:string; path?:string; commit_id?:string; original_commit_id?:string; in_reply_to_id?:number; }
interface GHIssueComment { id:number; body?:string; html_url:string; user?:{login?:string}; created_at:string; }
interface GHReview { id:number; body?:string; html_url:string; user?:{login?:string}; submitted_at?:string; state?:string; }
interface GHCompare { files?:Array<{filename:string;previous_filename?:string}>; }

export class GitHubCollector {
  private readonly token:string|undefined;
  private readonly maxPullRequests:number;
  private readonly includeIssueComments:boolean;
  private readonly collectThreadResolution:boolean;
  private readonly deepEvidence:boolean;
  private readonly maxDeepComparisonsPerPullRequest:number;
  private deepComparisonCount=0;

  constructor(options:GitHubCollectorOptions={}) {
    this.token=options.token;
    this.maxPullRequests=options.maxPullRequests??100;
    this.includeIssueComments=options.includeIssueComments??false;
    this.collectThreadResolution=options.collectThreadResolution??true;
    this.deepEvidence=options.deepEvidence??false;
    this.maxDeepComparisonsPerPullRequest=Math.max(1,options.maxDeepComparisonsPerPullRequest??12);
  }

  private headers(){return {Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28',...(this.token?{Authorization:`Bearer ${this.token}`}:{})};}
  private async get<T>(url:string):Promise<T>{const res=await fetch(url,{headers:this.headers()});if(!res.ok){const remain=res.headers.get('x-ratelimit-remaining'),reset=res.headers.get('x-ratelimit-reset');throw new Error(`GitHub API ${res.status}: ${await res.text()}${remain==='0'?`\nRate limit reached. Reset epoch: ${reset}`:''}`);}return res.json() as Promise<T>;}
  private async graphql<T>(query:string,variables:Record<string,unknown>):Promise<T>{if(!this.token)throw new Error('GitHub GraphQL requires GITHUB_TOKEN.');const res=await fetch('https://api.github.com/graphql',{method:'POST',headers:{'content-type':'application/json',Authorization:`Bearer ${this.token}`},body:JSON.stringify({query,variables})});if(!res.ok)throw new Error(`GitHub GraphQL ${res.status}: ${await res.text()}`);const json=await res.json() as{data?:T;errors?:Array<{message:string}>};if(json.errors?.length)throw new Error(`GitHub GraphQL: ${json.errors.map(e=>e.message).join('; ')}`);if(!json.data)throw new Error('GitHub GraphQL returned no data.');return json.data;}
  private async resolvedCommentIds(owner:string,repo:string,number:number):Promise<Set<number>>{if(!this.token||!this.collectThreadResolution)return new Set();type ThreadData={repository:{pullRequest:{reviewThreads:{nodes:Array<{isResolved:boolean;comments:{nodes:Array<{databaseId:number|null}>}}>}|null}|null}|null};const query=`query($owner:String!,$repo:String!,$number:Int!){repository(owner:$owner,name:$repo){pullRequest(number:$number){reviewThreads(first:100){nodes{isResolved comments(first:50){nodes{databaseId}}}}}}}`;const data=await this.graphql<ThreadData>(query,{owner,repo,number}),ids=new Set<number>();for(const thread of data.repository?.pullRequest?.reviewThreads?.nodes??[])if(thread.isResolved)for(const c of thread.comments.nodes)if(c.databaseId)ids.add(c.databaseId);return ids;}
  private async paged<T>(url:string,limit=1000):Promise<T[]>{const out:T[]=[];for(let page=1;out.length<limit;page++){const join=url.includes('?')?'&':'?',batch=await this.get<T[]>(`${url}${join}per_page=100&page=${page}`);out.push(...batch);if(batch.length<100)break;}return out.slice(0,limit);}
  private async mergedPullRequests(owner:string,repo:string):Promise<GitHubPR[]>{const merged:GitHubPR[]=[];for(let page=1;merged.length<this.maxPullRequests&&page<=20;page++){const batch=await this.get<GitHubPR[]>(`https://api.github.com/repos/${owner}/${repo}/pulls?state=closed&sort=updated&direction=desc&per_page=100&page=${page}`);merged.push(...batch.filter(p=>p.merged_at));if(batch.length<100)break;}return merged.slice(0,this.maxPullRequests);}

  private async postReviewChangeState(owner:string,repo:string,pr:GitHubPR,comments:GHReviewComment[]):Promise<{changed:Set<number>;checked:Set<number>}> {
    const changed=new Set<number>(),checked=new Set<number>(),head=pr.head?.sha;
    if(!this.deepEvidence||!head)return{changed,checked};
    const groups=new Map<string,GHReviewComment[]>();
    for(const comment of comments){
      if(comment.in_reply_to_id||!comment.path)continue;
      const base=comment.commit_id||comment.original_commit_id;
      if(!base||base===head)continue;
      groups.set(base,[...(groups.get(base)??[]),comment]);
    }
    const bases=[...groups.keys()].slice(0,this.maxDeepComparisonsPerPullRequest);
    for(const base of bases){
      try{
        this.deepComparisonCount++;
        const comparison=await this.get<GHCompare>(`https://api.github.com/repos/${owner}/${repo}/compare/${base}...${head}`);
        const files=new Set((comparison.files??[]).flatMap(f=>[f.filename,f.previous_filename].filter((x):x is string=>Boolean(x))));
        for(const comment of groups.get(base)??[]){checked.add(comment.id);if(comment.path&&files.has(comment.path))changed.add(comment.id);}
      }catch{
        // Deep evidence is optional. Failed comparisons remain unchecked rather than being treated as rejection.
      }
    }
    return{changed,checked};
  }

  private async collectPullRequest(repository:string,owner:string,repo:string,pr:GitHubPR):Promise<ReviewRecord[]> {
    const [comments,reviews,issueComments,resolvedIds]=await Promise.all([
      this.paged<GHReviewComment>(`https://api.github.com/repos/${owner}/${repo}/pulls/${pr.number}/comments`,500),
      this.paged<GHReview>(`https://api.github.com/repos/${owner}/${repo}/pulls/${pr.number}/reviews`,200),
      this.includeIssueComments?this.paged<GHIssueComment>(`https://api.github.com/repos/${owner}/${repo}/issues/${pr.number}/comments`,300):Promise.resolve([] as GHIssueComment[]),
      this.resolvedCommentIds(owner,repo,pr.number).catch(()=>new Set<number>())
    ]);
    const changeState=await this.postReviewChangeState(owner,repo,pr,comments),responses=inferAuthorReviewResponses(comments,pr.user?.login);
    const records:ReviewRecord[]=[];
    for(const c of comments)if(c.body?.trim())records.push({id:`rc-${c.id}`,repo:repository,prNumber:pr.number,prTitle:pr.title,author:pr.user?.login,reviewer:c.user?.login??'unknown',body:c.body,path:c.path,createdAt:c.created_at,url:c.html_url,resolved:resolvedIds.has(c.id),changedAfterReview:changeState.changed.has(c.id),deepEvidenceChecked:changeState.checked.has(c.id),explicitResponse:responses.get(c.id),source:'review-comment'});
    for(const r of reviews)if(r.body?.trim())records.push({id:`rv-${r.id}`,repo:repository,prNumber:pr.number,prTitle:pr.title,author:pr.user?.login,reviewer:r.user?.login??'unknown',body:r.body,createdAt:r.submitted_at??new Date().toISOString(),url:r.html_url,accepted:r.state==='APPROVED',source:'review'});
    for(const c of issueComments)if(c.body?.trim())records.push({id:`ic-${c.id}`,repo:repository,prNumber:pr.number,prTitle:pr.title,author:pr.user?.login,reviewer:c.user?.login??'unknown',body:c.body,createdAt:c.created_at,url:c.html_url,source:'issue-comment'});
    return records;
  }

  async collectWithState(repository:string,previous?:GitHubCollectionState):Promise<GitHubCollectionResult>{
    const[owner,repo]=repository.split('/');if(!owner||!repo)throw new Error('Repository must be in owner/name form.');
    this.deepComparisonCount=0;
    const merged=await this.mergedPullRequests(owner,repo),byPr=new Map<number,ReviewRecord[]>();
    if(previous?.repository===repository)for(const record of previous.records)byPr.set(record.prNumber,[...(byPr.get(record.prNumber)??[]),record]);
    const records:ReviewRecord[]=[],prUpdatedAt:Record<string,string>={};let fetchedPullRequests=0,cachedPullRequests=0,position=0;
    for(const pr of merged){position++;prUpdatedAt[String(pr.number)]=pr.updated_at;const reusable=previous?.schemaVersion===2&&previous.repository===repository&&previous.prUpdatedAt[String(pr.number)]===pr.updated_at&&byPr.has(pr.number);if(reusable){cachedPullRequests++;records.push(...(byPr.get(pr.number)??[]));process.stderr.write(`\rCollecting reviews ${position}/${merged.length} (PR #${pr.number}, cached)`);continue;}fetchedPullRequests++;process.stderr.write(`\rCollecting reviews ${position}/${merged.length} (PR #${pr.number})`);records.push(...await this.collectPullRequest(repository,owner,repo,pr));}
    process.stderr.write('\n');
    const state:GitHubCollectionState={schemaVersion:2,repository,generatedAt:new Date().toISOString(),prUpdatedAt,records};
    return{records,state,stats:{pullRequests:merged.length,fetchedPullRequests,cachedPullRequests,deepComparisons:this.deepComparisonCount}};
  }
  async collect(repository:string){return(await this.collectWithState(repository)).records;}
  async collectDocumentation(repository:string):Promise<Array<{path:string;content:string}>>{const[owner,repo]=repository.split('/');if(!owner||!repo)throw new Error('Repository must be in owner/name form.');const paths=['AGENTS.md','CLAUDE.md','CONTRIBUTING.md','.github/copilot-instructions.md','.cursorrules','.cursor/rules/repository.mdc','.github/CODEOWNERS','CODEOWNERS','docs/CODEOWNERS'],out:Array<{path:string;content:string}>=[];for(const path of paths){try{const data=await this.get<{type:string;content?:string;encoding?:string}>(`https://api.github.com/repos/${owner}/${repo}/contents/${path}`);if(data.type==='file'&&data.content&&data.encoding==='base64'){const bytes=Uint8Array.from(atob(data.content.replace(/\n/g,'')),c=>c.charCodeAt(0));out.push({path,content:new TextDecoder().decode(bytes)});}}catch(err){if(!(err instanceof Error)||!err.message.includes('404'))throw err;}}return out;}
}
