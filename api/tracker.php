<?php
// Additive tables: existing calendar rows and files are never migrated or rewritten.
function tracker_schema(PDO $db): void {
    $db->exec("CREATE TABLE IF NOT EXISTS tracker_records (
      id TEXT PRIMARY KEY, client_id TEXT NOT NULL, kind TEXT NOT NULL,
      title TEXT NOT NULL, campaign_id TEXT, job_id TEXT, data TEXT NOT NULL,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS tracker_uploads (path TEXT PRIMARY KEY, client_id TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS tracker_scope ON tracker_records(client_id, kind);");
}
function tracker_row(array $r): array {
    $data=json_decode($r['data'], true) ?: [];
    // Keep legacy records readable after removing the production/review stages.
    if ($r['kind']==='jobs' && in_array($data['status']??'', ['designing','in_review'],true)) $data['status']='brief';
    return array_merge($r['kind']==='jobs' ? ['variation'=>''] : [], $data, [
      'id'=>$r['id'], 'kind'=>$r['kind'], 'title'=>$r['title'],
      'archived'=>!empty($data['archived_at']), 'archived_at'=>$data['archived_at']??null,
      'campaign_id'=>$r['campaign_id'], 'job_id'=>$r['job_id'],
      'created_at'=>$r['created_at'], 'updated_at'=>$r['updated_at']]);
}
function tracker_routes(PDO $db, array $seg, string $method): void {
    $ctx = require_auth(); require_team($ctx); $client = require_client_scope($ctx);
    $kind = $seg[1] ?? '';
    if (!in_array($kind, ['jobs','campaigns','payments'], true) || count($seg)>3) fail('Not found',404);
    $id = $seg[2] ?? null;
    if ($id==='archive-month' && $method==='POST' && $kind!=='payments') {
        $b=body_json();$month=$b['month']??'';
        if (!is_string($month) || !preg_match('/^\d{4}-(0[1-9]|1[0-2])$/',$month)) fail('Choose an expiry month.');
        $today=(new DateTimeImmutable('now',new DateTimeZone('Asia/Kolkata')))->format('Y-m-d');
        $db->exec('BEGIN IMMEDIATE');
        try {
            $q=$db->prepare('SELECT * FROM tracker_records WHERE client_id=? AND kind IN (?,?)');$q->execute([$client,$kind,'campaigns']);$rows=$q->fetchAll(PDO::FETCH_ASSOC);
            $campaigns=[];foreach($rows as $row) if($row['kind']==='campaigns')$campaigns[$row['id']]=json_decode($row['data'],true)?:[];
            $count=0;$now=now_iso();
            foreach($rows as $row) {
                if($row['kind']!==$kind)continue;
                $data=json_decode($row['data'],true)?:[];
                if(!empty($data['archived_at']))continue;
                $dates=$data;
                if($kind==='jobs' && empty($data['start_date']) && empty($data['end_date']))$dates=$campaigns[$row['campaign_id']]??[];
                $end=$dates['end_date']??'';$start=$dates['start_date']??'';
                if(!$start || !$end || $end<$start || substr($end,0,7)!==$month || $end>=$today)continue;
                $data['archived_at']=$now;
                $db->prepare('UPDATE tracker_records SET data=?,updated_at=? WHERE id=? AND client_id=?')->execute([json_encode($data),$now,$row['id'],$client]);$count++;
            }
            $db->exec('COMMIT');send_json(['archived_count'=>$count]);
        } catch(Throwable $e) {$db->exec('ROLLBACK');throw $e;}
    }
    $existing = null;
    if ($id) {
        $q=$db->prepare('SELECT * FROM tracker_records WHERE id=? AND client_id=? AND kind=?');
        $q->execute([$id,$client,$kind]); $existing=$q->fetch(PDO::FETCH_ASSOC);
        if (!$existing) fail('Not found',404);
    }
    if ($method==='GET') {
        if ($existing) send_json(tracker_row($existing));
        $q=$db->prepare('SELECT * FROM tracker_records WHERE client_id=? AND kind=? ORDER BY created_at DESC, id DESC');
        $q->execute([$client,$kind]); send_json(array_map('tracker_row',$q->fetchAll(PDO::FETCH_ASSOC)));
    }
    if ($method==='DELETE' && $id) {
        $q=$db->prepare('SELECT 1 FROM tracker_records WHERE client_id=? AND (campaign_id=? OR job_id=?) LIMIT 1');
        $q->execute([$client,$id,$id]);
        if ($q->fetchColumn()) fail('This record has linked media or payments. Remove those links first.',409);
        $q=$db->prepare('DELETE FROM tracker_records WHERE id=? AND client_id=?'); $q->execute([$id,$client]); no_content();
    }
    if (!(($method==='POST' && !$id) || ($method==='PATCH' && $id))) fail('Method not allowed',405);
    $b=body_json();
    // Removing from the working list is reversible. Linked invoices and files
    // remain untouched; archive/restore needs no valid artwork to succeed.
    if (array_key_exists('archived',$b)) {
        if (!$existing || $method!=='PATCH' || count($b)!==1 || !is_bool($b['archived']) || $kind==='payments') fail('Archive is only available for existing media and campaigns.');
        $data=json_decode($existing['data'],true)?:[];
        $data['archived_at']=$b['archived']?($data['archived_at']??now_iso()):null;
        $db->prepare('UPDATE tracker_records SET data=?,updated_at=? WHERE id=? AND client_id=?')->execute([json_encode($data),now_iso(),$id,$client]);
        $q=$db->prepare('SELECT * FROM tracker_records WHERE id=? AND client_id=?');$q->execute([$id,$client]);send_json(tracker_row($q->fetch(PDO::FETCH_ASSOC)));
    }
    $allowed=['title','campaign_id','job_id','notes','status','medium','placement','variation','owner','location','specifications','start_date','end_date','due_date','counterparty','direction','amount_minor','paid_minor','reference','currency','media'];
    foreach (array_keys($b) as $key) if (!in_array($key,$allowed,true)) fail('Unknown field: '.$key);
    $d=array_merge($existing ? tracker_row($existing) : [],$b);
    if (isset($d['media'])) {
        if (!is_array($d['media']) || count($d['media'])>50) fail('Invalid attachments');
        $media=[];
        foreach ($d['media'] as $m) {
            if (!is_array($m) || !is_string($m['path']??null) || basename($m['path'])!==$m['path']) fail('Invalid attachment');
            $q=$db->prepare('SELECT 1 FROM tracker_uploads WHERE path=? AND client_id=?');
            $q->execute([$m['path'],$client]); if (!$q->fetchColumn()) fail('Upload this attachment in the current workspace first.');
            global $MEDIA_URL, $MEDIA_DIR;
            if (!is_file($MEDIA_DIR.'/'.$m['path'])) fail('Attachment is missing. Please upload again.');
            $clean=['path'=>$m['path'],'url'=>$MEDIA_URL.'/'.$m['path'],'name'=>basename((string)($m['name']??$m['path']))];
            $thumb=pathinfo($m['path'],PATHINFO_FILENAME).'.thumb.jpg';
            if (is_file($MEDIA_DIR.'/'.$thumb)) $clean['thumb']=$MEDIA_URL.'/'.$thumb;
            $media[]=$clean;
        }
        $d['media']=$media;
    }
    if (!is_string($d['title']??null)) fail('Enter a title.');
    $title=trim($d['title']); if ($title==='' || strlen($title)>200) fail('Enter a title up to 200 characters.');
    foreach (['notes','owner','location','specifications','counterparty','reference'] as $key) {
        if (isset($d[$key]) && (!is_string($d[$key]) || strlen($d[$key])>10000)) fail('Invalid '.$key);
    }
    foreach (['start_date','end_date','due_date'] as $key) {
        if (!empty($d[$key])) {
            if (!is_string($d[$key])) fail('Invalid date');
            $date=DateTime::createFromFormat('!Y-m-d',(string)$d[$key]);
            if (!$date || $date->format('Y-m-d')!==$d[$key]) fail('Invalid date');
        }
    }
    if ($kind!=='payments' && (array_key_exists('start_date',$b)||array_key_exists('end_date',$b)) && (empty($d['start_date'])!==empty($d['end_date']))) fail('Set both start and end dates, or clear both to use campaign dates.');
    if (!empty($d['start_date']) && !empty($d['end_date']) && $d['end_date']<$d['start_date']) fail('End date must follow start date.');
    foreach (['campaign_id'=>'campaigns','job_id'=>'jobs'] as $key=>$target) {
        if (!empty($d[$key])) {
            if (!is_string($d[$key])) fail('Invalid linked record');
            $q=$db->prepare('SELECT 1 FROM tracker_records WHERE id=? AND client_id=? AND kind=?');
            $q->execute([$d[$key],$client,$target]); if (!$q->fetchColumn()) fail('Linked record not found in this workspace.');
        }
    }
    $statuses=$kind==='jobs' ? ['brief','approved','scheduled','live','completed'] : ['planned','active','completed'];
    if ($kind!=='payments') {
        $d['status']=$d['status']??$statuses[0];
        if ($kind==='jobs' && in_array($d['status'],['designing','in_review'],true)) $d['status']='brief';
        if (!in_array($d['status'],$statuses,true)) fail('Invalid status');
    }
    if ($kind==='jobs') {
        if (!in_array($d['medium']??'', ['print','digital'],true) || !in_array($d['placement']??'', ['outdoor','indoor','online'],true)) fail('Choose medium and placement.');
        // One shared catalogue powers the form, filters and server validation.
        $catalog=json_decode(file_get_contents(__DIR__.'/tracker-taxonomy.json'),true);
        $variation=$d['variation']??'';
        if (!is_string($variation)) fail('Invalid media variation');
        if ($variation!=='') {
            $options=$catalog[$d['placement']]['variations'];
            $match=null;
            foreach($options as $option) if($option['id']===$variation) { $match=$option; break; }
            if (!$match) fail('Choose a variation belonging to this placement.');
            if (!in_array($d['medium'],$match['mediums'],true)) fail('This variation does not support the selected medium.');
        }
        $d['variation']=$variation; // Legacy items stay visible as Unclassified.
        if ($d['medium']==='print' && $d['placement']==='online') fail('Online placement requires digital media.');
    }
    // Manual approval applies only to the current creative, never silently to a replacement.
    if ($kind==='jobs' && $existing) {
        $old=tracker_row($existing);
        if (($old['status']??'')==='approved') {
            foreach (['title','medium','placement','variation','location','specifications','media'] as $key) {
                if (($old[$key]??null)!==($d[$key]??null)) { $d['status']='brief'; break; }
            }
        }
    }
    if ($kind==='payments') {
        foreach (['amount_minor','paid_minor'] as $key) if (!isset($d[$key]) || !is_int($d[$key]) || $d[$key]<0 || $d[$key]>100000000000) fail('Invalid amount');
        if ($d['amount_minor']===0 || $d['paid_minor']>$d['amount_minor']) fail('Enter a positive total and a paid amount no greater than the total.');
        if (!in_array($d['direction']??'', ['payable','receivable'],true)) fail('Choose payable or receivable.');
        $d['currency']='INR'; // Initial ledger is single-currency; never aggregate mixed currencies.
    }
    $id=$id??new_id(); $now=now_iso();
    unset($d['id'],$d['kind'],$d['created_at'],$d['updated_at'],$d['archived']);
    $q=$db->prepare('INSERT INTO tracker_records(id,client_id,kind,title,campaign_id,job_id,data,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,campaign_id=excluded.campaign_id,job_id=excluded.job_id,data=excluded.data,updated_at=excluded.updated_at');
    $q->execute([$id,$client,$kind,$title,($d['campaign_id']??null)?:null,($d['job_id']??null)?:null,json_encode($d),$existing['created_at']??$now,$now]);
    $q=$db->prepare('SELECT * FROM tracker_records WHERE id=? AND client_id=?'); $q->execute([$id,$client]); send_json(tracker_row($q->fetch(PDO::FETCH_ASSOC)),$existing?200:201);
}
