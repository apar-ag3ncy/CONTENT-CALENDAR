import type { CSSProperties } from 'react'
export type IconName = 'plus' | 'arrow' | 'back' | 'check' | 'clock' | 'review' | 'progress' | 'location' | 'calendar' | 'layers' | 'campaign' | 'wallet' | 'search' | 'outdoor' | 'indoor' | 'online' | 'chevron-left' | 'chevron-right' | 'close'
const paths: Record<IconName, React.ReactNode> = {
  plus: <path d="M12 5v14M5 12h14"/>, arrow:<path d="M7 17 17 7M7 7h10v10"/>, back:<path d="m10 5-7 7 7 7M3 12h18"/>,
  check:<path d="m5 12 4 4L19 6"/>, clock:<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  review:<><path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/></>,
  progress:<><path d="M12 3a9 9 0 1 1-9 9M3 7V3h4"/><path d="m3 3 5 5M12 7v5l3 2"/></>,
  location:<><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2"/></>,
  calendar:<><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 11h18M7 15h2M13 15h4"/></>,
  layers:<><path d="m12 3 10 5-10 5L2 8l10-5ZM2 12l10 5 10-5M2 16l10 5 10-5"/></>,
  campaign:<><path d="m3 9 12-5v16L3 15V9ZM15 8h4a3 3 0 0 1 0 6h-4M6 16v5h4l-1-4"/></>,
  wallet:<><rect x="3" y="5" width="18" height="15" rx="2"/><path d="M3 9h18M21 12h-6v5h6M16 5V3H5a2 2 0 0 0-2 2"/></>,
  search:<><circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/></>,
  outdoor:<><rect x="3" y="4" width="18" height="12" rx="1"/><path d="M7 16v5M17 16v5M7 9h10M7 12h6"/></>,
  indoor:<><path d="m3 10 9-7 9 7v11H3V10Z"/><path d="M9 21v-8h6v8"/></>,
  online:<><circle cx="12" cy="12" r="9"/><ellipse cx="12" cy="12" rx="4" ry="9"/><path d="M3 12h18"/></>,
  'chevron-left':<path d="m15 5-7 7 7 7"/>, 'chevron-right':<path d="m9 5 7 7-7 7"/>, close:<path d="m6 6 12 12M18 6 6 18"/>,
}
export function UiIcon({name,size=18,className,style}:{name:IconName;size?:number;className?:string;style?:CSSProperties}) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} style={{flexShrink:0,...style}}>{paths[name]}</svg>
}
