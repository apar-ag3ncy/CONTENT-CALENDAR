import { UiIcon } from '../../components/UiIcon'
import { statusFor, money, paymentTotals, type RecordItem } from './model'

export function StatusBadge({record}:{record:Partial<RecordItem>}) {
  const s=statusFor(record)
  return <span className={`tracker-badge tk-tone-${s.tone}`}><UiIcon name={s.icon} size={14}/>{s.label}</span>
}
export function CompletionProgress({done,total,label='Completed'}:{done:number;total:number;label?:string}) {
  const percent=total?Math.round(done/total*100):0
  return <div className="tk-completion"><div><span>{label}</span><strong>{total?`${done} of ${total} · ${percent}%`:'No items yet'}</strong></div><div className="tk-meter" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={total||1} aria-valuenow={done} aria-valuetext={total?`${done} of ${total} completed`:'No items yet'}><span style={{width:`${percent}%`}}/></div></div>
}
export function JobSummary({records}:{records:RecordItem[]}) {
  const buckets=[{tone:'pending',name:'Pending',icon:'clock'},{tone:'working',name:'Approved / scheduled',icon:'calendar'},{tone:'working',name:'Live',icon:'online'},{tone:'done',name:'Completed',icon:'check'}] as const
  const done=records.filter(r=>r.status==='completed').length
  return <section className="tk-summary" aria-label="Progress for this selection"><div className="tk-summary-heading"><div><h3>Progress at a glance</h3><p>For this placement, variation and search. Live items stay visible until marked completed.</p></div><span className="tk-total">{records.length} items</span></div><div className="tk-summary-counts">{buckets.map(b=><div key={b.name} className={`tk-summary-count tk-tone-${b.tone}`}><UiIcon name={b.icon}/><span>{b.name}</span><strong>{records.filter(r=>b.name==='Live'?r.status==='live':b.name==='Approved / scheduled'?['approved','scheduled'].includes(r.status??''):statusFor(r).tone===b.tone).length}</strong></div>)}</div><CompletionProgress done={done} total={records.length}/></section>
}

export function MoneyProgress({settled,total,received=false}:{settled:number;total:number;received?:boolean}) {
  const percent=total?Math.min(100,Math.round(settled/total*100)):0
  return <div className="tk-completion tk-money-progress"><div><span>{received?'Received':'Paid'} <strong>{money(settled)}</strong></span><strong>{percent}%</strong></div><div className={`tk-meter ${received?'tk-meter-received':''}`} role="progressbar" aria-label={received?'Amount received':'Amount paid'} aria-valuemin={0} aria-valuemax={total||1} aria-valuenow={settled} aria-valuetext={`${money(settled)} of ${money(total)} ${received?'received':'paid'}`}><span style={{width:`${percent}%`}}/></div></div>
}

export function PaymentSummary({records,compact=false,simple=false}:{records:RecordItem[];compact?:boolean;simple?:boolean}) {
  return <section className={`tk-payment-summary ${compact?'is-compact':''} ${simple?'is-simple':''}`} aria-label="Payment progress">{(['payable','receivable'] as const).map(direction=>{
    const items=records.filter(r=>r.direction===direction),t=paymentTotals(items),received=direction==='receivable'
    if(simple)return <div key={direction} className="tk-money-brief"><div><span>{received?'To collect':'To pay'}</span><strong>{money(t.remaining)}</strong></div><MoneyProgress settled={t.settled} total={t.total} received={received}/>{t.overdue>0&&<p className="tk-overdue">{money(t.overdue)} overdue</p>}</div>
    return <div key={direction} className="tk-money-card"><div className="tk-summary-heading"><h3><UiIcon name={received?'campaign':'wallet'}/>{received?'Client collections':'Vendor payments'}</h3><span className="tk-total">{items.length} {items.length===1?'invoice':'invoices'}</span></div><p className="tk-money-label">{received?'Still to collect':'Still to pay'}</p><strong className="tk-money-balance">{money(t.remaining)}</strong><div className="tk-money-total"><span>Total invoiced</span><span>{money(t.total)}</span></div><MoneyProgress settled={t.settled} total={t.total} received={received}/><p className={t.overdue?'tk-overdue':'tracker-muted'}>{t.overdue?`${money(t.overdue)} overdue`:'No overdue balance'}</p></div>
  })}</section>
}

export function CampaignSummary({records,jobs}:{records:RecordItem[];jobs:RecordItem[]}) {
  const ids=new Set(records.map(r=>r.id)),linked=jobs.filter(j=>!!j.campaign_id&&ids.has(j.campaign_id))
  return <section className="tk-summary" aria-label="Campaign progress"><div className="tk-summary-heading"><div><h3>Campaign progress</h3><p>Campaign status is tracked separately from delivery of its linked media.</p></div><span className="tk-total">{records.length} campaigns</span></div><div className="tk-summary-counts tk-campaign-counts">{([{id:'planned',label:'Planned',tone:'pending'},{id:'active',label:'Active',tone:'working'},{id:'completed',label:'Completed',tone:'done'}] as const).map(s=><div key={s.id} className={`tk-summary-count tk-tone-${s.tone}`}><UiIcon name={s.id==='completed'?'check':'campaign'}/><span>{s.label}</span><strong>{records.filter(r=>r.status===s.id).length}</strong></div>)}</div><div className="tk-dual-progress"><CompletionProgress done={records.filter(r=>r.status==='completed').length} total={records.length} label="Campaigns completed"/><CompletionProgress done={linked.filter(r=>r.status==='completed').length} total={linked.length} label="Linked media completed"/></div></section>
}
