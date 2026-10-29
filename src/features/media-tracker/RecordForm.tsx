import { useState } from 'react'
import { Modal } from '../../components/Modal'
import { DropZone } from '../../components/DropZone'
import { UiIcon } from '../../components/UiIcon'
import { names, placements, taxonomy, variationsFor, label, stages, money, currentStatus, type Kind, type RecordItem } from './model'
import { MoneyProgress } from './Progress'
import { TenureFields } from './TenureFields'

type Props = {kind:Kind;record:Partial<RecordItem>;campaigns:RecordItem[];jobs:RecordItem[];saving:boolean;error?:string;onClose:()=>void;onSave:(r:Partial<RecordItem>)=>void}
export function RecordForm({kind,record,campaigns,jobs,saving,error,onClose,onSave}:Props) {
  const [form,setForm]=useState<Partial<RecordItem>>({status:kind==='jobs'?'brief':'planned',medium:'print',placement:'outdoor',variation:'',direction:'payable',campaign_id:'',job_id:'',...record,...(kind==='jobs'&&record.status?{status:currentStatus(record.status)}:{})})
  const [uploading,setUploading]=useState(false)
  const [amount,setAmount]=useState(String((record.amount_minor??0)/100))
  const [paid,setPaid]=useState(String((record.paid_minor??0)/100))
  const set=(key:keyof RecordItem,value:string)=>setForm(f=>({...f,[key]:value}))
  const variation=variationsFor(form.placement).find(v=>v.id===form.variation)
  const mediums=variation?.mediums??(form.placement==='online'?['digital']:['print','digital'])
  function changePlacement(value:string) {
    setForm(f=>({...f,placement:value,variation:'',medium:value==='online'?'digital':f.medium}))
  }
  function changeVariation(value:string) {
    const option=variationsFor(form.placement).find(v=>v.id===value)
    setForm(f=>({...f,variation:value,medium:option&&!option.mediums.includes(f.medium??'')?option.mediums[0]:f.medium}))
  }
  const field=(key:keyof RecordItem,title:string,type='text',required=false,placeholder?:string)=><label>{title}{required&&<span className="tk-required">Required</span>}<input type={type} required={required} maxLength={key==='title'?200:10000} placeholder={placeholder} value={String(form[key]??'')} onChange={e=>set(key,e.target.value)}/></label>
  const select=(key:keyof RecordItem,title:string,options:{value:string;name:string}[],change?:(s:string)=>void)=><label>{title}<select value={String(form[key]??'')} onChange={e=>(change??(v=>set(key,v)))(e.target.value)}>{options.map(o=><option key={o.value} value={o.value}>{o.name}</option>)}</select></label>
  const opts=(values:string[])=>values.map(value=>({value,name:label(value)}))
  return <Modal open wide onClose={()=>{if(!saving&&!uploading)onClose()}} title={`${record.id?'Edit':'Add'} ${names[kind].toLowerCase()}`}>
    <form className="tracker tracker-form tk-form-simple" onSubmit={e=>{
      e.preventDefault(); if(saving||uploading)return
      onSave({...form,...(kind==='payments'?{amount_minor:Math.round(Number(amount)*100),paid_minor:Math.round(Number(paid)*100)}:{})})
    }}>
      <fieldset disabled={saving}>
        <section className="tk-form-section">
          {field('title',kind==='payments'?'Invoice name':'Name','text',true,kind==='jobs'?'e.g. Diwali hoarding — Bandra':undefined)}
          {kind!=='payments'&&select('status','Status',kind==='jobs'?stages.map(s=>({value:s.id,name:s.label})):opts(['planned','active','completed']))}
          {kind==='jobs'&&<>
            {select('campaign_id','Campaign',[{value:'',name:'No campaign'},...campaigns.map(c=>({value:c.id,name:c.title}))])}
            <div className="tracker-form-grid">
              {select('placement','Placement',placements.map(value=>({value,name:taxonomy[value].label})),changePlacement)}
              {select('variation','Type',[{value:'',name:'Choose a type'},...variationsFor(form.placement).map(v=>({value:v.id,name:v.label}))],changeVariation)}
            </div>
            {select('medium','Medium',opts(mediums))}
          </>}
          {kind==='payments'&&<>
            <div className="tracker-form-grid">{select('direction','Direction',[{value:'payable',name:'To pay — vendor'},{value:'receivable',name:'To collect — client'}])}{field('counterparty','Vendor / client','text',true)}</div>
            <div className="tracker-form-grid"><label>Total (INR)<input required type="number" min="0.01" max="1000000000" step="0.01" value={amount} onChange={e=>setAmount(e.target.value)}/></label><label>{form.direction==='receivable'?'Received':'Paid'} so far (INR)<input required type="number" min="0" max={amount} step="0.01" value={paid} onChange={e=>setPaid(e.target.value)}/></label></div>
            <div className="tk-form-payment-summary"><MoneyProgress total={Math.max(0,Math.round(Number(amount||0)*100))} settled={Math.max(0,Math.round(Number(paid||0)*100))} received={form.direction==='receivable'}/><p>Balance: <strong>{money(Math.max(0,Math.round((Number(amount||0)-Number(paid||0))*100)))}</strong></p><p className="tracker-muted">Enter the total {form.direction==='receivable'?'received':'paid'} so far, including earlier instalments.</p></div>
            {field('due_date','Due date','date')}
          </>}
        </section>
        {kind!=='payments'&&<TenureFields form={{...form,kind}} campaigns={campaigns} onChange={dates=>setForm(f=>({...f,...dates}))}/>}
        {kind==='jobs'&&<section className="tk-form-section"><h3>Files</h3><div className="tracker-upload"><DropZone value={form.media??[]} onChange={media=>setForm(f=>({...f,media}))} multiple disabled={saving} onUploadingChange={setUploading}/></div></section>}
        <details className="tk-disclosure tk-form-optional"><summary>More details <span>Optional</span></summary><div className="tk-form-section">
          {kind==='jobs'&&<><div className="tracker-form-grid">{field('owner','Assigned to')}{field('location','Location','text',false,'e.g. Bandra, Linking Road')}</div>{field('specifications','Size or specifications','text',false,'e.g. 20 × 10 ft')}{field('due_date','Work due date','date')}</>}
          {kind==='campaigns'&&field('due_date','Work due date','date')}
          {kind==='payments'&&<>{select('campaign_id','Campaign',[{value:'',name:'No campaign'},...campaigns.map(c=>({value:c.id,name:c.title}))])}{select('job_id','Media item',[{value:'',name:'No media item'},...jobs.map(j=>({value:j.id,name:j.title}))])}{field('reference','Invoice reference')}</>}
          <label>Notes<textarea rows={3} maxLength={10000} value={form.notes??''} onChange={e=>set('notes',e.target.value)}/></label>
        </div></details>
        {error&&<p className="tracker-error" role="alert">{error}</p>}
        <div className="tracker-form-actions"><button className="tracker-secondary" type="button" disabled={uploading} onClick={onClose}>Cancel</button><button disabled={uploading} className="tracker-primary" type="submit">{uploading?'Uploading…':saving?'Saving…':record.id?'Save changes':'Add record'}</button></div>
      </fieldset>
    </form>
  </Modal>
}
