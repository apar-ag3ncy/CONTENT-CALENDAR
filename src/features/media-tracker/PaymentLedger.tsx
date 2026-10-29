import { Link } from 'react-router-dom'
import { RecordThumbnail } from './RecordThumbnail'
import { MoneyProgress, StatusBadge } from './Progress'
import { dateLabel, money, paymentBalance, statusFor, type RecordItem, type TrackerData } from './model'

export function PaymentLedger({records,data,onEdit}:{records:RecordItem[];data:TrackerData;onEdit:(r:RecordItem)=>void}) {
  // Unsettled invoices first; within each group the earliest due date comes first.
  const sorted=[...records].sort((a,b)=>Number(paymentBalance(a)===0)-Number(paymentBalance(b)===0)||(a.due_date||'9999').localeCompare(b.due_date||'9999')||a.title.localeCompare(b.title))
  return <ul className="tk-ledger" aria-label="Invoices">{sorted.map(r=>{
    const received=r.direction==='receivable',campaign=data.campaigns.find(c=>c.id===r.campaign_id)
    return <li key={r.id} className="tk-invoice-compact">
      <Link className="tk-invoice-title" to={`/media-tracker/payments/${r.id}`}><RecordThumbnail record={r} data={data}/><div><strong>{r.title}</strong><span>{r.counterparty||campaign?.title||'Payment record'}</span><small>{received?'To collect':'To pay'} · Due {dateLabel(r.due_date)}</small><StatusBadge record={r}/></div></Link>
      <div className="tk-invoice-balance"><div><span>Balance</span><strong className={statusFor(r).id==='overdue'?'tk-overdue':''}>{money(paymentBalance(r))}</strong></div><MoneyProgress settled={r.paid_minor??0} total={r.amount_minor??0} received={received}/></div>
      <button className="tk-row-edit" aria-label={`Update ${r.title}`} onClick={()=>onEdit(r)}>Update</button>
    </li>
  })}</ul>
}
