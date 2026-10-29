"""Local integration check. Creates isolated workspace fixtures; removes them in finally.
Run with PHP at 127.0.0.1:8080 and the project's local SQLite database.
"""
import sqlite3, json, secrets, urllib.request, urllib.error, base64
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo
base='http://127.0.0.1:8080/api'
db=sqlite3.connect(Path(__file__).resolve().parents[1]/'api/data/calendar.sqlite')
ids=[secrets.token_hex(12) for _ in range(3)]
a,b,user=ids
token=secrets.token_hex(32); clienttoken=secrets.token_hex(32)
now=datetime.now(timezone.utc).isoformat(); expires=(datetime.now(timezone.utc)+timedelta(days=1)).isoformat()
def call(path, method='GET', data=None, client=a, auth=token, expected=200):
    headers={'Content-Type':'application/json','X-Client-Id':client}
    if auth:headers['Authorization']='Bearer '+auth
    request=urllib.request.Request(base+path,data=json.dumps(data).encode() if data is not None else None,headers=headers,method=method)
    try:
        with urllib.request.urlopen(request) as response: status=response.status; raw=response.read()
    except urllib.error.HTTPError as error: status=error.code;raw=error.read()
    assert status==expected, (method,path,status,expected,raw.decode()[:300])
    return json.loads(raw) if raw else None
uploaded=None
try:
    for cid in [a,b]:db.execute('INSERT INTO clients(id,name,username,password_enc,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?)',(cid,'Tracker smoke',cid,'unused','active',now,now))
    db.execute('INSERT INTO team_users(id,name,username,password_hash,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?)',(user,'Tracker smoke',user,'unused','active',now,now))
    for tok,kind,uid,cid in [(token,'team',user,None),(clienttoken,'client',a,a)]:db.execute('INSERT INTO sessions(token,user_kind,user_id,client_id,created_at,expires_at,last_seen) VALUES(?,?,?,?,?,?,?)',(tok,kind,uid,cid,now,expires,now))
    db.commit()
    call('/tracker/jobs',auth=None,expected=401)
    call('/tracker/payments',auth=clienttoken,expected=403)
    c=call('/tracker/campaigns','POST',{'title':'Launch','status':'active','start_date':'2000-01-01','end_date':'2000-01-31'},expected=201)
    j=call('/tracker/jobs','POST',{'title':'Hoarding','campaign_id':c['id'],'medium':'print','placement':'outdoor','status':'brief'},expected=201)
    assert j.get('variation')=='', 'Legacy unclassified records should remain readable'
    call('/tracker/jobs/'+j['id'],'PATCH',{'variation':'led_screen'},expected=400)
    led=call('/tracker/jobs/'+j['id'],'PATCH',{'variation':'led_screen','medium':'digital'})
    assert led['variation']=='led_screen'
    call('/tracker/jobs/'+j['id'],'PATCH',{'placement':'indoor'},expected=400)
    call('/tracker/jobs/'+j['id'],'PATCH',{'variation':'not_a_real_variation'},expected=400)
    call('/tracker/jobs/'+j['id'],'PATCH',{'variation':'hoarding','medium':'print'})
    assert call('/tracker/jobs/'+j['id'],'PATCH',{'status':'in_review'})['status']=='brief'
    call('/tracker/jobs/'+j['id'],'PATCH',{'start_date':'2026-01-01'},expected=400)
    call('/tracker/jobs/'+j['id'],'PATCH',{'start_date':'2026-01-10','end_date':'2026-01-01'},expected=400)
    call('/tracker/jobs/'+j['id'],client=b,expected=404)
    call('/tracker/jobs','POST',{'title':'Cross client','campaign_id':c['id'],'medium':'print','placement':'outdoor'},client=b,expected=400)
    call('/tracker/campaigns/'+c['id'],'DELETE',expected=409)
    call('/tracker/jobs','POST',{'title':'Bad','medium':'print','placement':'online'},expected=400)
    call('/tracker/jobs','POST',{'title':'Bad','medium':'print','placement':'outdoor','due_date':'2026-02-30'},expected=400)
    p=call('/tracker/payments','POST',{'title':'Printer invoice','job_id':j['id'],'direction':'payable','amount_minor':120050,'paid_minor':50000},expected=201)
    assert p['amount_minor']==120050
    call('/tracker/payments/'+p['id'],'PATCH',{'paid_minor':130000},expected=400)
    p=call('/tracker/payments/'+p['id'],'PATCH',{'paid_minor':120050})
    assert p['paid_minor']==120050
    payment_edit={k:v for k,v in p.items() if k not in ['id','kind','created_at','updated_at','archived','archived_at']}
    call('/tracker/payments/'+p['id'],'PATCH',payment_edit)
    call('/tracker/jobs/'+j['id'],'DELETE',expected=409)
    call('/tracker/jobs/'+j['id'],'PATCH',{'media':[{'path':'fake.jpg','name':'Fake'}]},expected=400)
    boundary='TrackerBoundary'+secrets.token_hex(8)
    png=base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=')
    body=('--'+boundary+'\r\nContent-Disposition: form-data; name="file"; filename="tracker-smoke.png"\r\nContent-Type: image/png\r\n\r\n').encode()+png+('\r\n--'+boundary+'--\r\n').encode()
    request=urllib.request.Request(base+'/media',data=body,headers={'Authorization':'Bearer '+token,'X-Client-Id':a,'Content-Type':'multipart/form-data; boundary='+boundary},method='POST')
    with urllib.request.urlopen(request) as response: uploaded=json.load(response)
    call('/tracker/jobs/'+j['id'],'PATCH',{'status':'approved'})
    changed=call('/tracker/jobs/'+j['id'],'PATCH',{'media':[uploaded]})
    assert changed['status']=='brief', 'Creative change retained approval'
    archived=call('/tracker/jobs/'+j['id'],'PATCH',{'archived':True})
    assert archived['archived'] and archived['archived_at']
    assert call('/tracker/payments/'+p['id'])['job_id']==j['id'], 'Archive broke invoice link'
    call('/tracker/jobs/'+j['id'],'PATCH',{'archived':False},client=b,expected=404)
    assert not call('/tracker/jobs/'+j['id'],'PATCH',{'archived':False})['archived']
    call('/tracker/payments/'+p['id'],'PATCH',{'archived':True},expected=400)
    call('/tracker/jobs/archive-month','POST',{'month':'2000-13'},expected=400)
    assert call('/tracker/jobs/archive-month','POST',{'month':'2000-01'},client=b)['archived_count']==0
    assert call('/tracker/jobs/archive-month','POST',{'month':'2000-01'})['archived_count']==1
    assert call('/tracker/jobs/'+j['id'])['archived']
    assert call('/tracker/jobs/archive-month','POST',{'month':'2000-01'})['archived_count']==0
    call('/tracker/jobs/'+j['id'],'PATCH',{'archived':False})
    lastday=datetime.now(ZoneInfo('Asia/Kolkata')).date().isoformat()
    boundary=call('/tracker/jobs','POST',{'title':'Ends today','medium':'digital','placement':'online','start_date':lastday,'end_date':lastday},expected=201)
    assert call('/tracker/jobs/archive-month','POST',{'month':lastday[:7]})['archived_count']==0, 'Archived an item before its last day ended'
    call('/tracker/jobs/'+boundary['id'],'DELETE',expected=204)
    call('/media/'+uploaded['path'],'DELETE',expected=204)
    assert (Path(__file__).resolve().parents[1]/'media'/uploaded['path']).exists(), 'Saved attachment was deleted'
    call('/tracker/payments/'+p['id'],'DELETE',expected=204)
    call('/tracker/jobs/'+j['id'],'DELETE',expected=204)
    call('/tracker/campaigns/'+c['id'],'DELETE',expected=204)
    call('/media/'+uploaded['path'],'DELETE',expected=204)
    print('PASS: auth, workspace isolation, tenure validation, inclusive monthly expiry, archive/restore, invoice preservation, exact money, uploads and deletion guards.')
finally:
    if db.execute("SELECT 1 FROM sqlite_master WHERE name='tracker_records'").fetchone():
        db.execute('DELETE FROM tracker_records WHERE client_id IN (?,?)',(a,b))
    if db.execute("SELECT 1 FROM sqlite_master WHERE name='tracker_uploads'").fetchone():
        db.execute('DELETE FROM tracker_uploads WHERE client_id IN (?,?)',(a,b))
    if uploaded:
        (Path(__file__).resolve().parents[1]/'media'/uploaded['path']).unlink(missing_ok=True)
    db.execute('DELETE FROM sessions WHERE token IN (?,?)',(token,clienttoken))
    db.execute('DELETE FROM clients WHERE id IN (?,?)',(a,b))
    db.execute('DELETE FROM team_users WHERE id=?',(user,));db.commit();db.close()
