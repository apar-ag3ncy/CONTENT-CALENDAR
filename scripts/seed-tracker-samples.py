"""Add editable, clearly labelled samples to ONE local workspace.
Usage: python3 scripts/seed-tracker-samples.py --client-id <local-client-id>
Never packaged for production. Re-running preserves existing records and edits.
"""
import argparse
import hashlib
import json
import sqlite3
import shutil
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--client-id', required=True)
parser.add_argument('--with-preview-assets', action='store_true', help='Attach existing project photos to sample media that have no attachments.')
args = parser.parse_args()
db_path = Path(__file__).resolve().parents[1] / 'api/data/calendar.sqlite'
if not db_path.is_file():
    raise SystemExit('Local database not found. Start the local PHP app first.')
db = sqlite3.connect(db_path)
client = db.execute("SELECT name FROM clients WHERE id=? AND status='active'", (args.client_id,)).fetchone()
if not client:
    raise SystemExit('Choose an existing, active local client workspace.')
stamp = datetime.now(timezone.utc).isoformat()
prefix = 'demo-tracker-' + hashlib.sha256(args.client_id.encode()).hexdigest()[:8] + '-'
day = lambda offset: (date.today() + timedelta(days=offset)).isoformat()
rid = lambda key: prefix + key
notes = 'SAMPLE DATA — fictional demonstration only. Editable locally; no real booking, invoice or payment.'
records = []

def add(kind, key, title, **data):
    data = {'notes': notes, **data}
    records.append((rid(key), args.client_id, kind, title, data.get('campaign_id'), data.get('job_id'), json.dumps(data), stamp, stamp))

add('campaigns', 'festive', 'Festive city launch', status='active', start_date=day(-7), end_date=day(14), due_date=day(14))
add('campaigns', 'store', 'Store launch — completed', status='completed', start_date=day(-21), end_date=day(-3), due_date=day(-3))
add('campaigns', 'winter', 'Winter collection preview', status='planned', start_date=day(14), end_date=day(28), due_date=day(28))

jobs = [
    ('hoarding','Bandra hoarding','outdoor','hoarding','print','brief','Bandra · Linking Road','Design team','festive',4),
    ('shelter','Bus shelter creative','outdoor','bus_shelter','print','brief','Andheri · Station Road','Creative lead','festive',3),
    ('led','LED launch film','outdoor','led_screen','digital','scheduled','BKC · Central Plaza','Motion team','festive',6),
    ('social','Social launch carousel','online','social','digital','live','Instagram','Social team','festive',0),
    ('poster','Window poster artwork','indoor','poster','print','approved','Flagship store','Design team','festive',5),
    ('standee','Store entrance standee','indoor','standee','print','completed','Flagship entrance','Production team','festive',-1),
    ('store-print','Opening day posters','indoor','poster','print','completed','Store lobby','Production team','store',-3),
    ('store-screen','Opening screen creative','indoor','indoor_screen','digital','completed','In-store screen','Motion team','store',-3),
    ('winter-ad','Winter display ads','online','display_ad','digital','brief','Display network','Creative lead','winter',18),
    ('winter-board','Winter outdoor concept','outdoor','hoarding','print','brief','Location to confirm','Design team','winter',21),
]
for key,title,placement,variation,medium,status,location,owner,campaign,due in jobs:
    add('jobs',key,title,placement=placement,variation=variation,medium=medium,status=status,location=location,owner=owner,campaign_id=rid(campaign),due_date=day(due),media=[])

# Amounts are integer paise; invoices intentionally include unpaid, partial,
# overdue and settled examples, separated into payables and receivables.
payments = [
    ('print-invoice','Hoarding print & installation','payable','Sample print vendor','SAMPLE-V-001',4800000,2400000,5,'festive','hoarding'),
    ('shelter-invoice','Bus shelter booking','payable','Sample outdoor vendor','SAMPLE-V-002',3000000,0,-2,'festive','shelter'),
    ('screen-invoice','LED screen booking','payable','Sample screen vendor','SAMPLE-V-003',2000000,0,8,'festive','led'),
    ('store-invoice','Store print production','payable','Sample print vendor','SAMPLE-V-004',1200000,1200000,-3,'store','store-print'),
    ('festive-fee','Festive campaign fee','receivable','Sample client','SAMPLE-C-001',15000000,6000000,7,'festive',None),
    ('winter-fee','Winter concept advance','receivable','Sample client','SAMPLE-C-002',4000000,0,-1,'winter',None),
    ('store-fee','Store launch fee','receivable','Sample client','SAMPLE-C-003',6000000,6000000,-3,'store',None),
]
for key,title,direction,party,reference,amount,paid,due,campaign,job in payments:
    add('payments',key,title,direction=direction,counterparty=party,reference=reference,amount_minor=amount,paid_minor=paid,currency='INR',due_date=day(due),campaign_id=rid(campaign),job_id=rid(job) if job else None)

before = db.total_changes
with db:
    db.executemany('INSERT OR IGNORE INTO tracker_records(id,client_id,kind,title,campaign_id,job_id,data,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)',records)
print(f'{client[0]}: added {db.total_changes-before} sample records (3 campaigns, 10 media, 7 invoices in the complete set). Existing data preserved.')
if args.with_preview_assets:
    root=db_path.parents[2]
    sources=['Light Collections-01p.jpg']+[f'Light Collections-0{i}.jpg' for i in range(2,7)]
    attached=0
    with db:
        for index, job in enumerate(jobs):
            row=db.execute('SELECT data FROM tracker_records WHERE id=? AND client_id=?',(rid(job[0]),args.client_id)).fetchone()
            if not row:continue
            data=json.loads(row[0])
            if data.get('media'):continue
            source=root/'public/photos'/sources[index%len(sources)]
            thumb=source.with_name(source.stem+'.thumb.jpg')
            if not source.is_file() or not thumb.is_file():continue
            name=prefix+f'asset-{index%len(sources)}.jpg'
            preview=Path(name).stem+'.thumb.jpg'
            for src,target in [(source,name),(thumb,preview)]:
                dest=root/'media'/target
                if not dest.exists():shutil.copy2(src,dest)
            db.execute('INSERT OR IGNORE INTO tracker_uploads(path,client_id) VALUES(?,?)',(name,args.client_id))
            data['media']=[{'path':name,'url':'/media/'+name,'thumb':'/media/'+preview,'name':source.name}]
            db.execute('UPDATE tracker_records SET data=?,updated_at=? WHERE id=? AND client_id=?',(json.dumps(data),stamp,rid(job[0]),args.client_id));attached+=1
    print(f'Attached project artwork to {attached} sample media records. Original source files unchanged.')
db.close()
