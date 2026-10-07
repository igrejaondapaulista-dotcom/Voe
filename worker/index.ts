import {json,sha,password,today,input,type Env,type User} from './security';
import {featureApi} from './features';
import {integrationAdmin,integrationRead} from './integrations';
export default {async fetch(req:Request,env:Env):Promise<Response>{
 const url=new URL(req.url),path=url.pathname,method=req.method;
 if(!path.startsWith('/api/'))return env.ASSETS.fetch(req);
 try {
 if(path.startsWith('/api/integracao/'))return await integrationRead(req,env);
 if(!['GET','HEAD'].includes(method)&&req.headers.get('Origin')!==url.origin)return json({error:'Origem inválida.'},403);
 if(Number(req.headers.get('Content-Length')||0)>262144)return json({error:'Solicitação muito grande.'},413);
 if(!['GET','HEAD'].includes(method)&&req.body){
 const reader=req.body.getReader(),parts:Uint8Array[]=[];let length=0;
 while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;if(length>262144){await reader.cancel();return json({error:'Solicitação muito grande.'},413)}parts.push(value)}
 const bytes=new Uint8Array(length);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.byteLength}
 req=new Request(req,{body:bytes});
 }
 if(path==='/api/login'&&method==='POST'){
 const b:any=await req.json();if(String(b.password||'').length>1024)return json({error:'Dados inválidos.'},400);const email=String(b.email||'').trim().toLowerCase();const ip=req.headers.get('CF-Connecting-IP')||'local';const key=await sha(ip+':'+email);const now=Date.now();
 const attempt=await env.DB.prepare('SELECT * FROM login_attempts WHERE key=?').bind(key).first<any>();if(attempt&&attempt.expires_at>now&&attempt.attempts>=8)return json({error:'Muitas tentativas. Aguarde 15 minutos.'},429);
 const u=await env.DB.prepare('SELECT * FROM users WHERE email=? AND active=1').bind(email).first<any>();
 if(!u||await password(String(b.password||''),u.salt)!==u.password_hash){await env.DB.prepare('INSERT INTO login_attempts VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=CASE WHEN expires_at<? THEN 1 ELSE attempts+1 END,expires_at=CASE WHEN expires_at<? THEN excluded.expires_at ELSE expires_at END').bind(key,now+900000,now,now).run();return json({error:'E-mail ou senha incorretos.'},401);}
 const token=crypto.randomUUID()+crypto.randomUUID();await env.DB.batch([env.DB.prepare('DELETE FROM login_attempts WHERE key=?').bind(key),env.DB.prepare('DELETE FROM sessions WHERE expires_at<?').bind(now),env.DB.prepare('INSERT INTO sessions VALUES (?,?,?)').bind(await sha(token),u.id,now+43200000)]);
 const res=json({user:{id:u.id,name:u.name,email:u.email,role:u.role_v2||u.role,volunteer_id:u.volunteer_id},volunteers:JSON.parse((await env.DB.prepare("SELECT data FROM app_records WHERE key='volunteers'").first<any>())?.data||'[]')});res.headers.set('Set-Cookie',`onda_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${url.protocol==='https:'?'; Secure':''}`);return res;
 }
 const token=req.headers.get('Cookie')?.match(/(?:^|;\s*)onda_session=([^;]+)/)?.[1];
 const user=token?await env.DB.prepare('SELECT u.id,u.name,u.email,COALESCE(u.role_v2,u.role) AS role,u.volunteer_id FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=? AND s.expires_at>? AND u.active=1').bind(await sha(token),Date.now()).first<User>():null;
 if(!user)return json({error:'Entre para continuar.'},401);
 if(path==='/api/me'&&method==='GET')return json({user,volunteers:JSON.parse((await env.DB.prepare("SELECT data FROM app_records WHERE key='volunteers'").first<any>())?.data||'[]')});
 if(path.startsWith('/api/integrations'))return await integrationAdmin(req,env,user);
 const feature=await featureApi(req,env,user);if(feature)return feature;
 if(path==='/api/logout'&&method==='POST'){await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await sha(token!)).run();const r=json({ok:true});r.headers.set('Set-Cookie','onda_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');return r;}
 if(path==='/api/dashboard'&&method==='GET'){
 const d=today();const totals=await env.DB.prepare('SELECT COUNT(*) AS total FROM visitors').first();
 const visits=await env.DB.prepare('SELECT COUNT(*) AS today,COALESCE(SUM(CASE WHEN NOT EXISTS (SELECT 1 FROM visits old WHERE old.visitor_id=v.visitor_id AND old.visit_date<v.visit_date) THEN 1 ELSE 0 END),0) AS first FROM visits v WHERE visit_date=?').bind(d).first<any>();
 const recent=await env.DB.prepare('SELECT p.*,v.visit_date,(SELECT COUNT(*) FROM visits WHERE visitor_id=p.id) AS visits_count FROM visits v JOIN visitors p ON p.id=v.visitor_id WHERE v.visit_date=? ORDER BY v.created_at DESC').bind(d).all();return json({date:d,total:(totals as any).total,today:visits.today,first:visits.first,returns:visits.today-visits.first,recent:recent.results});
 }
 if(path==='/api/visitors'&&method==='GET'){const q=(url.searchParams.get('q')||'').slice(0,120);const rows=await env.DB.prepare('SELECT p.*,(SELECT COUNT(*) FROM visits WHERE visitor_id=p.id) AS visits_count,(SELECT MAX(visit_date) FROM visits WHERE visitor_id=p.id) AS last_visit FROM visitors p WHERE name LIKE ? OR phone LIKE ? ORDER BY name COLLATE NOCASE LIMIT 200').bind('%'+q+'%','%'+(q.replace(/\D/g,'')||q)+'%').all();const followups=(await env.DB.prepare('SELECT * FROM visitor_followup').all<any>()).results;return json({visitors:rows.results.map((v:any)=>({...v,followup:JSON.parse(followups.find(f=>f.visitor_id===v.id)?.data||'null')}))});}
 if(path==='/api/visitors'&&method==='POST'){const b:any=await req.json();const v=input(b);const existing=await env.DB.prepare('SELECT id FROM visitors WHERE phone=?').bind(v.phone).first<any>();if(existing)return json({error:'Telefone já cadastrado. Abra o cadastro para registrar o retorno.',existingId:existing.id},409);const id=crypto.randomUUID();await env.DB.batch([env.DB.prepare('INSERT INTO visitors(id,name,phone,consent,consent_at) VALUES(?,?,?,?,?)').bind(id,v.name,v.phone,v.consent,v.consent?new Date().toISOString():null),env.DB.prepare('INSERT INTO visits(id,visitor_id,visit_date,created_by) VALUES(?,?,?,?)').bind(crypto.randomUUID(),id,today(),user.id)]);return json({id},201);}
 const follow=path.match(/^\/api\/visitors\/([^/]+)\/followup$/);
 if(follow&&method==='PUT'){
 const visitor=await env.DB.prepare('SELECT id FROM visitors WHERE id=?').bind(follow[1]).first();if(!visitor)return json({error:'Visitante não encontrado.'},404);
 const b:any=await req.json();if(!['pending','contacted'].includes(b.status)||typeof b.note!=='string'||b.note.length>500)return json({error:'Verifique o acompanhamento e use até 500 caracteres.'},400);
 const old=await env.DB.prepare('SELECT data FROM visitor_followup WHERE visitor_id=?').bind(follow[1]).first<any>();const prior=old?JSON.parse(old.data):null;
 const value={status:b.status,note:b.note.trim(),contacted_at:b.status==='contacted'?(prior?.contacted_at||new Date().toISOString()):null,contacted_by:b.status==='contacted'?(prior?.contacted_by||user.name):null,updated_at:new Date().toISOString(),updated_by:user.name};
 await env.DB.prepare('INSERT INTO visitor_followup(visitor_id,data) VALUES(?,?) ON CONFLICT(visitor_id) DO UPDATE SET data=excluded.data').bind(follow[1],JSON.stringify(value)).run();return json({ok:true,followup:value});
 }
 const match=path.match(/^\/api\/visitors\/([^/]+)(\/visits)?$/);
 if(match){const id=match[1];const person=await env.DB.prepare('SELECT * FROM visitors WHERE id=?').bind(id).first<any>();if(!person)return json({error:'Visitante não encontrado.'},404);
 if(match[2]&&method==='POST'){await env.DB.prepare('INSERT OR IGNORE INTO visits(id,visitor_id,visit_date,created_by) VALUES(?,?,?,?)').bind(crypto.randomUUID(),id,today(),user.id).run();return json({ok:true});}
 if(!match[2]&&method==='GET'){const history=await env.DB.prepare('SELECT v.visit_date,v.created_at,u.name AS receptionist FROM visits v JOIN users u ON u.id=v.created_by WHERE visitor_id=? ORDER BY visit_date DESC').bind(id).all();const f=await env.DB.prepare('SELECT data FROM visitor_followup WHERE visitor_id=?').bind(id).first<any>();return json({visitor:{...person,followup:f?JSON.parse(f.data):null},history:history.results});}
 if(!match[2]&&method==='PUT'){const v=input(await req.json());const duplicate=await env.DB.prepare('SELECT id FROM visitors WHERE phone=? AND id<>?').bind(v.phone,id).first();if(duplicate)return json({error:'Telefone já pertence a outro cadastro.'},409);await env.DB.prepare("UPDATE visitors SET name=?,phone=?,consent=?,consent_at=?,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?").bind(v.name,v.phone,v.consent,v.consent?(person.consent?person.consent_at:new Date().toISOString()):null,id).run();return json({ok:true});}
 if(!match[2]&&method==='DELETE'&&user.role==='admin'){await env.DB.prepare('DELETE FROM visitors WHERE id=?').bind(id).run();return json({ok:true});}
 }
 return json({error:'Operação não permitida.'},403);
 }catch(e){if(e instanceof SyntaxError)return json({error:'Dados inválidos.'},400);const msg=e instanceof Error?e.message:'';if(msg.startsWith('Informe'))return json({error:msg},400);if(msg.includes('STATE_CONFLICT'))return json({error:'Outra pessoa atualizou estes dados. Atualize a página e tente novamente.'},409);if(msg.includes('UNIQUE'))return json({error:'Este cadastro já existe.'},409);console.error('API error',msg);return json({error:'Não foi possível concluir. Tente novamente.'},500);}
}};
