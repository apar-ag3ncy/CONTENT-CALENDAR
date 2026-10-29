import { useState } from 'react'
import { Link, NavLink, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { req } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { UiIcon, type IconName } from '../../components/UiIcon'
import { RecordForm } from './RecordForm'
import { Modal } from '../../components/Modal'
import { CompletionProgress, MoneyProgress, PaymentSummary, StatusBadge } from './Progress'
import { PaymentLedger } from './PaymentLedger'
import { RecordThumbnail } from './RecordThumbnail'
import { Tenure } from './Tenure'
import { timelineFor } from './timeline'
import { RetentionFilters } from './RetentionFilters'
import { taxonomy, placements, variationsFor, variationLabel, names, money, label, dateLabel, statusFor, isOverdue, isSample, stages, type Kind, type RecordItem, type TrackerData, type Placement } from './model'
import './tracker.css'

export default function MediaTracker({ section = 'jobs' }: { section?: Kind }) {
  const { id } = useParams()
  const session = useAuth()
  return <TrackerWorkspace key={`${session?.activeClientId}:${section}:${id??''}`} section={section} id={id} client={session?.activeClientId}/>
}
function TrackerWorkspace({section,id,client}:{section:Kind;id?:string;client?:string|null}) {
  const cache=useQueryClient(), nav=useNavigate()
  const [params,setParams]=useSearchParams()
  const read=(key:string)=>params.get(key)??''
  const search=read('q'), status=read('status'), campaign=read('campaign'), placement=read('placement'), variation=read('variation'), medium=read('medium'), direction=read('direction'), period=read('period'), expiry=read('expiry')
  const [filtersOpen,setFiltersOpen]=useState(false)
  const [editing,setEditing]=useState<Partial<RecordItem>|null>(null)
  const [notice,setNotice]=useState('')
  const [archiveConfirm,setArchiveConfirm]=useState<{action:{record:RecordItem;restore:boolean}|{month:string};message:string}|null>(null)
  function filter(key:string,value:string) {
    setParams(p=>{const n=new URLSearchParams(p); value?n.set(key,value):n.delete(key);if(key==='placement')n.delete('variation');return n},{replace:true})
  }
  const query=useQuery({queryKey:['tracker',client],enabled:!!client,queryFn:async()=>{
    const [jobs,campaigns,payments]=await Promise.all((['jobs','campaigns','payments'] as Kind[]).map(k=>req<RecordItem[]>(`/api/tracker/${k}`)))
    return {jobs,campaigns,payments}
  }})
  const data=query.data??{jobs:[],campaigns:[],payments:[]}
  const mutation=useMutation({mutationFn:async({record,remove}:{record:Partial<RecordItem>;remove?:boolean})=>{
    const {id:rid,kind,created_at,updated_at,archived,archived_at,...body}=record
    return req<RecordItem>(`/api/tracker/${section}${rid?`/${rid}`:''}`,{method:remove?'DELETE':rid?'PATCH':'POST',...(!remove?{body:JSON.stringify(body)}:{})})
  },onSuccess:(saved,variables)=>{
    setEditing(null)
    setNotice(variables.remove?'Record deleted.':variables.record.status==='approved'&&saved.status==='brief'?'Saved. The creative changed, so approval was cleared and the item is pending.':'Record saved successfully.')
    cache.invalidateQueries({queryKey:['tracker',client]})
  }})
  const retention=useMutation({mutationFn:async(action:{record:RecordItem;restore:boolean}|{month:string})=>{
    if('month' in action)return req<{archived_count:number}>(`/api/tracker/${section}/archive-month`,{method:'POST',body:JSON.stringify({month:action.month})})
    return req<RecordItem>(`/api/tracker/${section}/${action.record.id}`,{method:'PATCH',body:JSON.stringify({archived:!action.restore})})
  },onSuccess:(saved,action)=>{setArchiveConfirm(null);setNotice('month' in action?`${(saved as {archived_count:number}).archived_count} expired records moved to archive.`:action.restore?'Restored to the current list.':'Removed from the current list. You can restore it from Archived.');cache.invalidateQueries({queryKey:['tracker',client]})}})
  function archiveMonth(count:number) {
    retention.reset()
    setArchiveConfirm({action:{month:expiry},message:`Move all ${count} expired ${section==='jobs'?'media items':'campaigns'} ending in ${expiry} to the archive? This applies to the whole selected month. Files and payment records are kept. You can restore these records later.`})
  }
  function archiveRecord(record:RecordItem) {
    retention.reset()
    if(record.archived)retention.mutate({record,restore:true})
    else setArchiveConfirm({action:{record,restore:false},message:`Remove “${record.title}” from the current list? Its files and linked payments will be kept. You can restore it from Archived.`})
  }
  const visibleRecords=data[section].filter(r=>{
    if(section==='payments')return true
    const t=timelineFor(r,data.campaigns)
    return (period==='archived'?r.archived:!r.archived&&(!period||t.state===period))&&(!expiry||t.end.slice(0,7)===expiry)
  })
  const current=id?data[section].find(r=>r.id===id):undefined
  const selected=visibleRecords.filter(r=>(!search||`${r.title} ${r.owner??''} ${r.counterparty??''} ${r.reference??''} ${r.location??''} ${variationLabel(r)}`.toLowerCase().includes(search.toLowerCase()))&&(!campaign||r.campaign_id===campaign)&&(section!=='payments'||!direction||r.direction===direction)&&(section!=='jobs'||((!placement||r.placement===placement)&&(!variation||(variation==='unclassified'?!r.variation:r.variation===variation))&&(!medium||r.medium===medium))))
  const filtered=selected.filter(r=>!status||statusFor(r).id===status)
  const statuses=section==='jobs'?stages.map(s=>({value:s.id,name:s.label})):section==='campaigns'?['planned','active','completed'].map(s=>({value:s,name:label(s)})):[{value:'unpaid',name:'Unpaid / awaiting'},{value:'part_paid',name:'Part paid / received'},{value:'paid',name:'Fully settled'},{value:'overdue',name:'Overdue'}]
  const canShowTotals=query.isSuccess
  function open(record:Partial<RecordItem>={}) {mutation.reset();setNotice('');setEditing(record)}
  function add() {
    const preset=variationsFor(placement).find(v=>v.id===variation)
    open(section==='jobs'&&placement?{placement,variation:preset?.id??'',medium:preset?.mediums[0]??(placement==='online'?'digital':'print'),campaign_id:campaign}:section!=='campaigns'?{campaign_id:campaign,...(section==='payments'&&direction?{direction}:{})}:{})
  }
  function remove(r:RecordItem) {
    if(window.confirm(`Delete “${r.title}”? This cannot be undone.`)) mutation.mutate({record:r,remove:true},{onSuccess:()=>{if(id)nav(`/media-tracker/${section}`)}})
  }
  const extraFilters=[campaign&&{key:'campaign',text:data.campaigns.find(c=>c.id===campaign)?.title||'Campaign'},medium&&{key:'medium',text:label(medium)},variation&&{key:'variation',text:variationsFor(placement).find(v=>v.id===variation)?.label||'Unclassified'},direction&&{key:'direction',text:direction==='payable'?'To pay':'To collect'},period&&{key:'period',text:label(period)},expiry&&{key:'expiry',text:`Ends ${expiry}`}].filter(Boolean) as {key:string;text:string}[]
  return <div className="tracker tracker-clean">
    <header className="tk-page-heading"><h1>Media tracker</h1><Link className="tracker-secondary" to={`/month/${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}`}><UiIcon name="calendar"/>Calendar</Link></header>
    <nav className="tracker-tabs" aria-label="Media tracker sections">
      {([['jobs','All media','layers'],['campaigns','Campaigns','campaign'],['payments','Payments','wallet']] as const).map(([key,title,icon])=><NavLink key={key} to={`/media-tracker/${key}`}><UiIcon name={icon}/><span>{title}</span><small>{canShowTotals?data[key].filter(r=>key==='payments'||!r.archived).length:'—'}</small></NavLink>)}
    </nav>
    {!client?<div className="tracker-panel">Choose a client workspace to begin.</div>:query.isPending?<div className="tracker-panel" role="status">Loading…</div>:query.isError?<div className="tracker-panel tracker-error" role="alert">{query.error.message}<button className="tracker-secondary" onClick={()=>query.refetch()}>Try again</button></div>:<>
      {notice&&<p role="status" className="tracker-notice"><UiIcon name="check"/>{notice}</p>}
      {retention.isError&&!archiveConfirm&&<p role="alert" className="tracker-error">{retention.error.message}</p>}
      {mutation.isError&&editing===null&&<p role="alert" className="tracker-error">{mutation.error.message}</p>}
      {id ? current ? <>
        <Link to={`/media-tracker/${section}`} className="tracker-back"><UiIcon name="back"/>Back to {section==='jobs'?'all media':section}</Link>
        <RecordDetail record={current} data={data} busy={mutation.isPending||retention.isPending} onArchive={()=>archiveRecord(current)} onEdit={()=>open(current)} onDelete={()=>remove(current)}/>
      </>:<div className="tracker-panel">This record was not found in this workspace.</div>:<section className="tracker-panel tk-workspace">
        <div className="tracker-heading"><div><h2>{section==='jobs'?'All media':label(section)}</h2>{data[section].some(isSample)&&<p className="tk-demo-note">Includes sample records{section==='payments'?' · fictional amounts':''}</p>}</div><button className="tracker-primary" onClick={add}><UiIcon name="plus"/>Add {section==='payments'?'payment':names[section].toLowerCase()}</button></div>
        {section==='jobs'&&<div className="tk-quick-placements" aria-label="Filter by placement"><FilterButton selected={!placement} onClick={()=>filter('placement','')} name="All"/>{placements.map(p=><FilterButton key={p} selected={placement===p} onClick={()=>filter('placement',p)} icon={p} name={taxonomy[p].label}/>)}</div>}
        <div className="tk-toolbar">
          <label className="tk-search"><span className="sr-only">Search records</span><div><UiIcon name="search"/><input aria-label="Search records" placeholder={section==='payments'?'Search invoice or name…':section==='campaigns'?'Search campaign…':'Search name, location or owner…'} value={search} onChange={e=>filter('q',e.target.value)}/></div></label>
          <select aria-label="Filter status" value={status} onChange={e=>filter('status',e.target.value)}><option value="">All statuses</option>{statuses.map(s=><option key={s.value} value={s.value}>{s.name}</option>)}</select>
          <button type="button" className="tracker-secondary" aria-expanded={filtersOpen} aria-controls="tracker-more-filters" onClick={()=>setFiltersOpen(!filtersOpen)}>Filters{extraFilters.length?` (${extraFilters.length})`:''}<span aria-hidden>{filtersOpen?'−':'+'}</span></button>
        </div>
        {filtersOpen&&<div id="tracker-more-filters" className="tk-more-filters">
          <div className="tracker-filters">
            {section!=='campaigns'&&<label>Campaign<select aria-label="Filter campaign" value={campaign} onChange={e=>filter('campaign',e.target.value)}><option value="">All campaigns</option>{data.campaigns.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select></label>}
            {section==='jobs'&&<><label>Variation<select aria-label="Filter variation" value={variation} disabled={!placement} onChange={e=>filter('variation',e.target.value)}><option value="">{placement?'All variations':'Choose Outdoor, Indoor or Online first'}</option>{variationsFor(placement).map(v=><option key={v.id} value={v.id}>{v.label}</option>)}<option value="unclassified">Unclassified</option></select></label><label>Medium<select aria-label="Filter medium" value={medium} onChange={e=>filter('medium',e.target.value)}><option value="">Print & digital</option><option value="print">Print</option><option value="digital">Digital</option></select></label></>}
            {section==='payments'&&<label>Direction<select aria-label="Filter direction" value={direction} onChange={e=>filter('direction',e.target.value)}><option value="">To pay & collect</option><option value="payable">To pay</option><option value="receivable">To collect</option></select></label>}
          </div>
          {section!=='payments'&&<RetentionFilters records={data[section]} campaigns={data.campaigns} period={period} month={expiry} onFilter={filter} onArchiveMonth={archiveMonth} busy={retention.isPending}/>}
        </div>}
        {extraFilters.length>0&&<div className="tk-active-filters" aria-label="Active filters">{extraFilters.map(f=><button key={f.key} type="button" onClick={()=>filter(f.key,'')} aria-label={`Remove filter: ${f.text}`}>{f.text}<UiIcon name="close" size={12}/></button>)}</div>}
        {section==='payments'?<PaymentSummary records={filtered} simple/>:<div className="tk-list-progress"><CompletionProgress done={filtered.filter(r=>r.status==='completed').length} total={filtered.length} label={section==='jobs'?'Media completed':'Campaigns completed'}/></div>}
        <div className="tk-result-heading"><span>{filtered.length} {filtered.length===1?'record':'records'}</span>{params.size>0&&<button className="tk-clear" onClick={()=>setParams({}, {replace:true})}>Clear filters</button>}</div>
        {filtered.length===0?<div className="tracker-empty"><h3>{data[section].length?'No matching records':'Nothing here yet'}</h3><p>{data[section].length?'Clear a filter or try another search.':`Add your first ${names[section].toLowerCase()}.`}</p>{data[section].length===0&&<button className="tracker-secondary" onClick={add}>Add {names[section].toLowerCase()}</button>}</div>:section==='jobs'?<JobGroups records={filtered} campaigns={data.campaigns} onEdit={open}/>:section==='payments'?<PaymentLedger records={filtered} data={data} onEdit={open}/>:<div className="tracker-records">{filtered.map(r=><CampaignRow key={r.id} record={r} data={data} onEdit={()=>open(r)}/>)}</div>}
      </section>}
      {archiveConfirm&&<Modal open title="Remove from current list?" onClose={()=>{if(!retention.isPending)setArchiveConfirm(null)}}><div className="tk-archive-dialog"><p>{archiveConfirm.message}</p>{retention.isError&&<p role="alert" className="tracker-error">{retention.error.message}</p>}<div className="tk-record-actions"><button type="button" className="tracker-secondary" disabled={retention.isPending} onClick={()=>setArchiveConfirm(null)}>Keep records</button><button type="button" className="tracker-primary" disabled={retention.isPending} onClick={()=>retention.mutate(archiveConfirm.action)}>{retention.isPending?'Removing…':'Move to archive'}</button></div></div></Modal>}
      {editing!==null&&<RecordForm key={editing.id||'new'} kind={section} record={editing} campaigns={data.campaigns} jobs={data.jobs} saving={mutation.isPending} error={mutation.error?.message} onClose={()=>setEditing(null)} onSave={record=>mutation.mutate({record})}/>}
    </>}
  </div>
}
function FilterButton({selected,onClick,name,icon}:{selected:boolean;onClick:()=>void;name:string;icon?:IconName}) {
  return <button type="button" className={`tk-filter-button ${selected?'is-selected':''}`} aria-pressed={selected} onClick={onClick}>{icon&&<UiIcon name={icon}/>}<span>{name}</span></button>
}
function EditButton({title,onClick}:{title:string;onClick:()=>void}) {return <button type="button" className="tk-row-edit" aria-label={`Edit ${title}`} onClick={onClick}>Edit</button>}
function JobGroups({records,campaigns,onEdit}:{records:RecordItem[];campaigns:RecordItem[];onEdit:(r:RecordItem)=>void}) {
  const groups=new Map<string,{placement:string;variation:string;items:RecordItem[]}>()
  for(const r of records) {const key=`${r.placement}/${r.variation??''}`;if(!groups.has(key))groups.set(key,{placement:r.placement??'unclassified',variation:variationLabel(r),items:[]});groups.get(key)!.items.push(r)}
  return <div className="tk-job-groups">{[...groups.entries()].sort(([,a],[,b])=>{const place=placements.indexOf(a.placement as Placement)-placements.indexOf(b.placement as Placement);if(place)return place;const order=(g:typeof a)=>{const i=variationsFor(g.placement).findIndex(v=>v.label===g.variation);return i<0?999:i};return order(a)-order(b)}).map(([key,g])=><section key={key} className="tk-job-group" aria-label={`${label(g.placement)} ${g.variation}`}>
    <div className="tk-group-heading"><div><h3>{label(g.placement)}<span>/</span>{g.variation}</h3><small>{g.items.length}</small></div></div>
    <ul>{g.items.map(r=><li key={r.id} className="tk-simple-row">
      <Link className="tk-row-link" to={`/media-tracker/jobs/${r.id}`}><RecordThumbnail record={r}/><div className="tk-row-name"><strong>{r.title}</strong><span>{r.location||campaigns.find(c=>c.id===r.campaign_id)?.title||label(r.medium)}</span><StatusBadge record={r}/>{isOverdue(r)&&<small className="tk-overdue">Due {dateLabel(r.due_date)}</small>}</div><Tenure record={r} campaigns={campaigns} compact/></Link><EditButton title={r.title} onClick={()=>onEdit(r)}/>
    </li>)}</ul>
  </section>)}</div>
}
function CampaignRow({record:r,data,onEdit}:{record:RecordItem;data:TrackerData;onEdit:()=>void}) {
  const jobs=data.jobs.filter(j=>j.campaign_id===r.id),done=jobs.filter(j=>j.status==='completed').length
  return <div className="tk-simple-row tk-campaign-row"><Link className="tk-row-link" to={`/media-tracker/campaigns/${r.id}`}><RecordThumbnail record={r} data={data}/><div className="tk-row-name"><strong>{r.title}</strong><span>{done} of {jobs.length} media completed</span><StatusBadge record={r}/></div><Tenure record={r} compact/></Link><EditButton title={r.title} onClick={onEdit}/></div>
}
function RecordDetail({record:r,data,busy,onEdit,onDelete,onArchive}:{record:RecordItem;data:TrackerData;busy:boolean;onEdit:()=>void;onDelete:()=>void;onArchive:()=>void}) {
  const jobs=data.jobs.filter(j=>j.campaign_id===r.id),payments=data.payments.filter(p=>r.kind==='campaigns'?p.campaign_id===r.id:p.job_id===r.id)
  const related=r.kind==='campaigns'?jobs:r.kind==='payments'?data.jobs.filter(j=>j.id===r.job_id):payments
  return <div className={`tracker-detail ${related.length?'':'tk-detail-single'}`}><section className="tracker-panel"><div className="tracker-heading tk-detail-heading"><RecordThumbnail record={r} data={data}/><div><h2>{r.title}</h2><StatusBadge record={r}/>{isSample(r)&&<span className="tk-sample-tag">Sample</span>}</div><button className="tracker-primary" disabled={busy} onClick={onEdit}>Edit</button></div>
    {r.archived&&<p className="tk-archive-notice">Archived · restore this item to return it to the list.</p>}
    {r.kind!=='payments'&&<Tenure record={r} campaigns={data.campaigns}/>}
    {r.kind==='campaigns'&&<CompletionProgress done={jobs.filter(j=>j.status==='completed').length} total={jobs.length} label="Media completed"/>}
    {r.kind==='payments'&&<MoneyProgress total={r.amount_minor??0} settled={r.paid_minor??0} received={r.direction==='receivable'}/>}
    {r.notes&&<p className="tracker-description">{r.notes}</p>}
    {r.media?.length?<div className="tracker-assets">{r.media.map(m=><a key={m.path} href={m.url} target="_blank" rel="noreferrer">{/\.(jpg|jpeg|png|webp)$/i.test(m.name)?<img loading="lazy" src={m.thumb||m.url} alt={m.name}/>:<span><UiIcon name="arrow" size={26}/></span>}<small>{m.name}</small></a>)}</div>:null}
    <dl className="tracker-facts">
      {r.kind==='jobs'&&<><Fact name="Placement" value={`${label(r.placement)} · ${variationLabel(r)} · ${label(r.medium)}`}/><Fact name="Assigned to" value={r.owner}/><Fact name="Location" value={r.location}/><Fact name="Specifications" value={r.specifications}/></>}
      {r.kind==='payments'&&<><Fact name="Direction" value={r.direction==='receivable'?'To collect':'To pay'}/><Fact name="Vendor / client" value={r.counterparty}/><Fact name="Reference" value={r.reference}/><Fact name="Total" value={money(r.amount_minor)}/><Fact name={r.direction==='receivable'?'Received':'Paid'} value={money(r.paid_minor)}/><Fact name="Balance" value={money((r.amount_minor??0)-(r.paid_minor??0))}/></>}
      {r.kind!=='campaigns'&&<Fact name="Campaign" value={data.campaigns.find(c=>c.id===r.campaign_id)?.title}/>}<Fact name="Due date" value={r.due_date?dateLabel(r.due_date):undefined}/>
    </dl>{r.kind!=='payments'&&payments.length>0&&<details className="tk-disclosure"><summary>Payment summary</summary><PaymentSummary records={payments} compact/></details>}
    <details className="tk-disclosure tk-record-actions-menu"><summary>More actions</summary><p className="tracker-muted">Last updated {new Date(r.updated_at).toLocaleDateString('en-IN')}</p><div className="tk-record-actions">{r.kind!=='payments'&&<button className="tracker-secondary" disabled={busy} onClick={onArchive}>{r.archived?'Restore to current list':'Remove from current list'}</button>}<button className="tracker-delete" disabled={busy} onClick={onDelete}>Delete permanently</button></div></details>
  </section>{related.length>0&&<aside className="tracker-panel"><h3>{r.kind==='campaigns'?'Campaign media':r.kind==='payments'?'Linked media':'Linked payments'}</h3>{related.map(link=><Link className="tracker-related" key={link.id} to={`/media-tracker/${link.kind}/${link.id}`}><RecordThumbnail record={link} data={data}/><span>{link.title}</span><UiIcon name="arrow"/></Link>)}</aside>}</div>
}
function Fact({name,value}:{name:string;value?:string}) {return value?<div><dt>{name}</dt><dd>{value}</dd></div>:null}
