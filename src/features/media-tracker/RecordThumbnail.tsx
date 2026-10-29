import { useState } from 'react'
import { UiIcon } from '../../components/UiIcon'
import type { RecordItem, TrackerData } from './model'

export function thumbnailFor(record:RecordItem,data?:TrackerData):string|undefined {
  const image=(r:RecordItem)=>r.media?.find(m=>m.thumb||/\.(jpe?g|png|webp|avif|gif)(?:\?|$)/i.test(m.name||m.url))
  const own=image(record)
  if(own)return own.thumb||own.url
  const related=record.kind==='campaigns'?data?.jobs.filter(j=>j.campaign_id===record.id):record.kind==='payments'?data?.jobs.filter(j=>j.id===record.job_id||(!record.job_id&&j.campaign_id===record.campaign_id)):[]
  const cover=related?.map(image).find(Boolean)
  return cover?.thumb||cover?.url
}
export function RecordThumbnail({record,data}:{record:RecordItem;data?:TrackerData}) {
  const src=thumbnailFor(record,data)
  const [failed,setFailed]=useState('')
  return <span className="tk-thumbnail" aria-hidden="true">{src&&failed!==src?<img src={src} alt="" loading="lazy" decoding="async" onError={()=>setFailed(src)}/>:<UiIcon name={record.kind==='payments'?'wallet':record.kind==='campaigns'?'campaign':'layers'} size={21}/>}</span>
}
