import catalog from '../../../api/tracker-taxonomy.json'
import type { MediaItem } from '../../types/database'
import type { IconName } from '../../components/UiIcon'
export type Kind = 'jobs' | 'campaigns' | 'payments'
export type Placement = keyof typeof catalog
export const taxonomy = catalog
export const placements = Object.keys(catalog) as Placement[]
export type RecordItem = {
  media?: MediaItem[]; id: string; title: string; kind: Kind; campaign_id?: string; job_id?: string;
  notes?: string; status?: string; medium?: string; placement?: string; variation?: string; owner?: string;
  location?: string; specifications?: string; start_date?: string; end_date?: string; due_date?: string;
  counterparty?: string; direction?: string; amount_minor?: number; paid_minor?: number; reference?: string;
  created_at: string; updated_at: string; archived?:boolean; archived_at?:string|null;
}
export type TrackerData = Record<Kind, RecordItem[]>
export type Tone = 'pending' | 'working' | 'review' | 'done' | 'danger' | 'neutral'
export const stages = [
  {id:'brief',label:'Pending',tone:'pending',icon:'clock'},
  {id:'approved',label:'Approved',tone:'working',icon:'check'},
  {id:'scheduled',label:'Scheduled',tone:'working',icon:'calendar'},
  {id:'live',label:'Live',tone:'working',icon:'online'},
  {id:'completed',label:'Completed',tone:'done',icon:'check'},
] as const
export const names = {jobs:'Media item', campaigns:'Campaign', payments:'Payment record'}
export const currentStatus=(status?:string)=>status==='designing'||status==='in_review'?'brief':status
export const label = (s='') => s.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase())
export const money = (n=0) => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format(n/100)
export const isSample = (r:Pick<RecordItem,'id'>) => r.id.startsWith('demo-tracker-')
export const paymentBalance = (r:Partial<RecordItem>) => Math.max(0,(r.amount_minor??0)-(r.paid_minor??0))
export function paymentTotals(records:RecordItem[]) {
  return records.reduce((totals,r)=>({total:totals.total+(r.amount_minor??0),settled:totals.settled+(r.paid_minor??0),remaining:totals.remaining+paymentBalance(r),overdue:totals.overdue+(statusFor(r).id==='overdue'?paymentBalance(r):0)}),{total:0,settled:0,remaining:0,overdue:0})
}
export function today() { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` }
export const dateLabel = (s?:string) => s ? new Date(s+'T12:00:00').toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}) : 'No date set'
export const variationsFor = (placement?:string) => placements.includes(placement as Placement) ? taxonomy[placement as Placement].variations : []
export const variationLabel = (r:Partial<RecordItem>) => variationsFor(r.placement).find(v=>v.id===r.variation)?.label ?? 'Unclassified'
export function statusFor(r:Partial<RecordItem>): {label:string;tone:Tone;icon:IconName;id:string} {
  if (r.kind==='payments') {
    const paid=(r.paid_minor??0)>=(r.amount_minor??0) && (r.amount_minor??0)>0
    const late=!paid&&!!r.due_date&&r.due_date<today()
    const id=paid?'paid':late?'overdue':r.paid_minor?'part_paid':'unpaid'
    const received=r.direction==='receivable'
    const name=paid?(received?'Received':'Paid'):late?'Overdue':r.paid_minor?(received?'Part received':'Part paid'):(received?'Awaiting payment':'Unpaid')
    return {id,label:name,tone:paid?'done':late?'danger':r.paid_minor?'working':'pending',icon:paid?'check':'clock'}
  }
  if(r.kind==='campaigns') return {id:r.status??'planned',label:label(r.status??'planned'),tone:r.status==='completed'?'done':r.status==='active'?'working':'pending',icon:r.status==='completed'?'check':'campaign'}
  const s=stages.find(s=>s.id===currentStatus(r.status))
  return s ? {id:s.id,label:s.label,tone:s.tone,icon:s.icon} : {id:r.status??'unknown',label:'Needs status',tone:'neutral',icon:'review'}
}
export function isOverdue(r:RecordItem) { return !!r.due_date&&r.due_date<today()&&!['live','completed'].includes(r.status??'') }
