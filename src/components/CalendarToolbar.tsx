import { Link } from 'react-router-dom'
import { monthKey, mondayOf, toISODate } from '../lib/dates'
import { UiIcon } from './UiIcon'
type View = 'year' | 'month' | 'week'
export function ViewSwitcher({active,refDate,hero=false}:{active:View;refDate:Date;hero?:boolean}) {
  const hrefs={year:`/year/${refDate.getFullYear()}`,month:`/month/${monthKey(refDate)}`,week:`/week/${toISODate(mondayOf(refDate))}`}
  return <nav className={`calendar-view-switch ${hero?'on-hero':''}`} aria-label="Calendar view">{(['year','month','week'] as View[]).map(key=><Link key={key} aria-current={active===key?'page':undefined} to={hrefs[key]}>{key[0].toUpperCase()+key.slice(1)}</Link>)}</nav>
}
interface ToolbarProps {view:View;title:string;subtitle?:string;prevTo:string;nextTo:string;todayTo:string;refDate:Date;hero?:boolean}
export function CalendarToolbar({view,title,subtitle,prevTo,nextTo,todayTo,refDate,hero=false}:ToolbarProps) {
  return <div className={`calendar-toolbar ${hero?'is-hero':''}`}>
    <div className="calendar-title-group"><div className="calendar-arrows"><Link to={prevTo} aria-label={`Previous ${view}`}><UiIcon name="chevron-left"/></Link><Link to={nextTo} aria-label={`Next ${view}`}><UiIcon name="chevron-right"/></Link></div><div><h1>{title}</h1>{subtitle&&<p>{subtitle}</p>}</div></div>
    <div className="calendar-tools"><Link className="calendar-today" to={todayTo}>Today</Link><ViewSwitcher active={view} refDate={refDate} hero={hero}/></div>
  </div>
}
