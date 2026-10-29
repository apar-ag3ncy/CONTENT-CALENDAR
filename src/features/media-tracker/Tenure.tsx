import { UiIcon } from '../../components/UiIcon'
import { dateLabel, type RecordItem } from './model'
import { timelineFor } from './timeline'

export function Tenure({record,campaigns=[],compact=false}:{record:Partial<RecordItem>;campaigns?:RecordItem[];compact?:boolean}) {
  const t=timelineFor(record,campaigns)
  if(t.state==='unset')return <div className="tk-tenure-unset"><UiIcon name="calendar" size={14}/>Set start & end dates for tenure</div>
  const detail=t.state==='expired'?`Expired ${dateLabel(t.end)}`:t.state==='upcoming'?`Starts ${dateLabel(t.start)}`:`${t.remaining} ${t.remaining===1?'day':'days'} left · through ${dateLabel(t.end)}`
  return <div className={`tk-tenure ${compact?'is-compact':''} ${t.state==='expired'?'is-expired':''}`}>
    <div className="tk-tenure-dates"><span><UiIcon name="calendar" size={14}/>{dateLabel(t.start)} <span aria-hidden>→</span> {dateLabel(t.end)}</span><strong>{t.label}</strong></div>
    {!compact&&<div className="tk-tenure-caption"><span>Tenure elapsed</span><span>{t.percent}% · {t.elapsed} of {t.total} days</span></div>}
    <div className="tk-meter tk-tenure-meter" role="progressbar" aria-label="Tenure elapsed" aria-valuemin={0} aria-valuemax={t.total} aria-valuenow={t.elapsed} aria-valuetext={`${t.elapsed} of ${t.total} days elapsed. ${detail}`}><span style={{width:`${t.percent}%`}}/></div>
    <div className="tk-tenure-caption"><span>{detail}</span>{t.inherited&&<span>Campaign dates</span>}</div>
  </div>
}
