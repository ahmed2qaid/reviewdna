import type { EvidenceDisposition, ReviewRecord } from '@reviewdna/schema';

export function evidenceDisposition(record:ReviewRecord):EvidenceDisposition{
  if(record.accepted||record.explicitResponse==='accepted')return'accepted';
  if(record.explicitResponse==='rejected')return'rejected-candidate';
  if(record.changedAfterReview)return'adopted';
  if(record.resolved)return'acknowledged';
  if(record.deepEvidenceChecked&&!record.changedAfterReview)return'rejected-candidate';
  return'unresolved';
}

export function acceptedEvidenceWeight(record:ReviewRecord):number{
  const disposition=evidenceDisposition(record);
  if(disposition==='accepted')return 1;
  if(disposition==='adopted')return .85;
  if(disposition==='acknowledged')return .35;
  return 0;
}

export function rejectedEvidenceWeight(record:ReviewRecord):number{
  if(record.explicitResponse==='rejected')return 1;
  return evidenceDisposition(record)==='rejected-candidate'?.35:0;
}
