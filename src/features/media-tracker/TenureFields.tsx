import { useState } from 'react'
import type { RecordItem } from './model'
import { monthEnd } from './timeline'
import { Tenure } from './Tenure'

export function TenureFields({form,campaigns,onChange}:{form:Partial<RecordItem>;campaigns:RecordItem[];onChange:(dates:{start_date:string;end_date:string})=>void}) {
  const [mode,setMode]=useState<'dates'|'months'>('dates')
  const parent=form.kind==='jobs'?campaigns.find(c=>c.id===form.campaign_id):undefined
  const required=form.kind==='campaigns'||!!form.start_date||!!form.end_date
  function changeMode(next:'dates'|'months') {
    setMode(next)
    if(next==='months')onChange({start_date:form.start_date?form.start_date.slice(0,7)+'-01':'',end_date:form.end_date?monthEnd(form.end_date.slice(0,7)):''})
  }
  return <div className="tk-tenure-fields"><div className="tk-tenure-field-head"><h3>Duration</h3><div className="tk-tenure-mode" aria-label="Tenure entry method"><button type="button" aria-pressed={mode==='dates'} onClick={()=>changeMode('dates')}>Exact dates</button><button type="button" aria-pressed={mode==='months'} onClick={()=>changeMode('months')}>Calendar months</button></div></div>
    {mode==='dates'?<div className="tracker-form-grid"><label>Start date<input type="date" required={required} value={form.start_date??''} onChange={e=>onChange({start_date:e.target.value,end_date:form.end_date??''})}/></label><label>End date<input type="date" required={required} min={form.start_date||undefined} value={form.end_date??''} onChange={e=>onChange({start_date:form.start_date??'',end_date:e.target.value})}/></label></div>:<div className="tracker-form-grid"><label>First month<input type="month" required={required} value={form.start_date?.slice(0,7)??''} onChange={e=>onChange({start_date:e.target.value?e.target.value+'-01':'',end_date:form.end_date??''})}/></label><label>Last month<input type="month" required={required} min={form.start_date?.slice(0,7)||undefined} value={form.end_date?.slice(0,7)??''} onChange={e=>onChange({start_date:form.start_date??'',end_date:e.target.value?monthEnd(e.target.value):''})}/></label></div>}
    <p className="tracker-muted">{mode==='months'?'Full months, first to last day.':'End date includes the last active day.'}</p>
    {parent?.start_date&&parent.end_date&&<button className="tracker-secondary" type="button" onClick={()=>onChange({start_date:'',end_date:''})}>Use campaign dates</button>}
    <Tenure record={form} campaigns={campaigns} compact/>
  </div>
}
