export interface ReviewSignalComment {
  id: number;
  body?: string | undefined;
  created_at: string;
  user?: { login?: string | undefined } | undefined;
  in_reply_to_id?: number | undefined;
}

export type ExplicitReviewResponse = 'accepted' | 'rejected';

const acceptedResponse=/\b(fixed|done|updated|addressed|implemented|changed|agreed|makes sense|good catch|resolved)\b/i;
const rejectedResponse=/\b(won't fix|wont fix|will not fix|not needed|intentional|by design|disagree|out of scope|not changing|leave (?:this|it) as is|keep(?:ing)? (?:this|it) as is)\b/i;

export function inferAuthorReviewResponses(comments:ReviewSignalComment[],author?:string):Map<number,ExplicitReviewResponse>{
  const out=new Map<number,ExplicitReviewResponse>();
  if(!author)return out;
  const normalizedAuthor=author.toLowerCase();
  const replies=comments
    .filter(comment=>comment.in_reply_to_id&&comment.body?.trim()&&comment.user?.login?.toLowerCase()===normalizedAuthor)
    .sort((a,b)=>a.created_at.localeCompare(b.created_at));
  for(const reply of replies){
    const body=reply.body??'';
    let response:ExplicitReviewResponse|undefined;
    if(rejectedResponse.test(body))response='rejected';
    else if(acceptedResponse.test(body))response='accepted';
    if(response&&reply.in_reply_to_id)out.set(reply.in_reply_to_id,response);
  }
  return out;
}
