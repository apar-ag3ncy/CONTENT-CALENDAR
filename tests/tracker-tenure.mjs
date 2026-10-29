import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

// Exercise the production date helpers without adding another test dependency.
const source=await readFile(new URL('../src/features/media-tracker/timeline.ts',import.meta.url),'utf8')
const output=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText
const {timelineFor,monthEnd,tenureLabel}=await import('data:text/javascript;base64,'+Buffer.from(output).toString('base64'))
assert.equal(monthEnd('2028-02'),'2028-02-29')
assert.equal(monthEnd('2026-02'),'2026-02-28')
assert.equal(tenureLabel('2026-11-01','2027-01-31'),'3 months · 92 days')
assert.equal(tenureLabel('2026-10-10','2026-10-10'),'1 day')
const r={kind:'campaigns',start_date:'2026-10-01',end_date:'2026-10-31'}
assert.equal(timelineFor(r,[],'2026-09-30').state,'upcoming')
assert.equal(timelineFor(r,[],'2026-10-31').state,'running','last day is still active')
assert.equal(timelineFor(r,[],'2026-11-01').state,'expired')
assert.equal(timelineFor(r,[],'2026-11-01').percent,100)
assert.equal(timelineFor(r,[],'2026-10-01').percent,0)
assert.equal(timelineFor(r,[],'2026-10-29').remaining,3)
const parent={...r,id:'campaign'}
const inherited=timelineFor({kind:'jobs',campaign_id:'campaign'},[parent],'2026-10-20')
assert.equal(inherited.inherited,true)
assert.equal(inherited.end,'2026-10-31')
const partial=timelineFor({kind:'jobs',campaign_id:'campaign',start_date:'2026-11-01'},[parent],'2026-10-20')
assert.equal(partial.state,'unset','never mix incompatible item and campaign bounds')
const override=timelineFor({kind:'jobs',campaign_id:'campaign',start_date:'2026-12-01',end_date:'2026-12-31'},[parent],'2026-11-01')
assert.equal(override.state,'upcoming')
assert.equal(override.inherited,false)
assert.equal(timelineFor({kind:'jobs',due_date:'2026-10-01'},[],'2026-11-01').state,'unset','due date is not tenure expiry')
console.log('PASS: inclusive expiry, leap-year/month tenure, year boundaries, inheritance, overrides and missing dates.')
