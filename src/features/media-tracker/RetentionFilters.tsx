import { timelineFor } from './timeline'
import type { RecordItem } from './model'

export function RetentionFilters({records,campaigns,period,month,onFilter,onArchiveMonth,busy}:{records:RecordItem[];campaigns:RecordItem[];period:string;month:string;onFilter:(key:string,value:string)=>void;onArchiveMonth:(count:number)=>void;busy:boolean}) {
  const options=[{id:'',name:'Current list'},{id:'upcoming',name:'Upcoming'},{id:'running',name:'Running'},{id:'expired',name:'Expired'},{id:'archived',name:'Archived'}]
  const count=(state:string)=>records.filter(r=>(state==='archived'?r.archived:!r.archived&&(!state||timelineFor(r,campaigns).state===state))&&(!month||timelineFor(r,campaigns).end.slice(0,7)===month)).length
  return <div className="tk-expiry-filters"><div className="tracker-filters"><label>Show<select aria-label="Show records" value={period} onChange={e=>onFilter('period',e.target.value)}>{options.map(o=><option key={o.id} value={o.id}>{o.name} ({count(o.id)})</option>)}</select></label><label>Expiry month<input aria-label="Expiry month" type="month" value={month} onChange={e=>onFilter('expiry',e.target.value)}/></label></div><p className="tracker-muted">Expired items stay until you remove them. Find removed items in Archived.</p>{month&&count('expired')>0&&period!=='archived'&&<div className="tk-retention-action"><span>{count('expired')} expired {count('expired')===1?'item':'items'} this month.</span><button className="tracker-secondary" disabled={busy} onClick={()=>onArchiveMonth(count('expired'))}>Remove expired month</button></div>}</div>
}
