import type { RecordItem } from './model'

const DAY=86400000
export function localToday() {
  // The agency's expiry clock is Indian time, shared with the PHP archive check.
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date())
  const get=(type:string)=>parts.find(p=>p.type===type)!.value
  return `${get('year')}-${get('month')}-${get('day')}`
}
const dayNumber=(iso:string)=>Date.parse(`${iso}T00:00:00Z`)/DAY
export function monthEnd(month:string) {
  const [year,m]=month.split('-').map(Number)
  return new Date(Date.UTC(year,m,0)).toISOString().slice(0,10)
}
export function tenureLabel(start:string,end:string) {
  const days=dayNumber(end)-dayNumber(start)+1
  const months=(Number(end.slice(0,4))-Number(start.slice(0,4)))*12+Number(end.slice(5,7))-Number(start.slice(5,7))+1
  return start.endsWith('-01')&&monthEnd(end.slice(0,7))===end
    ? `${months} ${months===1?'month':'months'} · ${days} days`
    : `${days} ${days===1?'day':'days'}`
}
export function timelineFor(record:Partial<RecordItem>,campaigns:RecordItem[]=[],asOf=localToday()) {
  const parent=record.kind==='jobs'?campaigns.find(c=>c.id===record.campaign_id):undefined
  // Inherit the WHOLE campaign window only when no item-specific dates exist.
  // Mixing one local bound with a parent's other bound can create invalid tenure.
  const inherited=!record.start_date&&!record.end_date&&!!parent?.start_date&&!!parent?.end_date
  const start=(inherited?parent?.start_date:record.start_date)||''
  const end=(inherited?parent?.end_date:record.end_date)||''
  const total=start&&end?dayNumber(end)-dayNumber(start)+1:0
  if(!start||!end||!Number.isFinite(total)||total<1) return {state:'unset' as const,start,end,total:0,elapsed:0,percent:0,label:'Tenure not set',inherited:false,remaining:0}
  // End date is inclusive. A placement ending today expires tomorrow.
  const state=asOf>end?'expired':asOf<start?'upcoming':'running'
  const elapsed=Math.max(0,Math.min(total,dayNumber(asOf)-dayNumber(start)))
  return {state,start,end,total,elapsed,percent:Math.round(elapsed/total*100),label:tenureLabel(start,end),inherited,remaining:Math.max(0,dayNumber(end)-dayNumber(asOf)+1)}
}
