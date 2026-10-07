import {json,sha,type Env,type User} from './security';
const prefix='integration:';
type Key={id:string;name:string;hash:string;created_at:string;created_by:string;revoked_at:string|null};
const publicKey=({hash,created_by,...key}:Key)=>key;
export async function integrationAdmin(req:Request,env:Env,user:User){
 if(user.role!=='admin')return json({error:'Somente administradores podem gerenciar integrações.'},403);
 const url=new URL(req.url);
 if(url.pathname==='/api/integrations'&&req.method==='GET'){
  const rows=await env.DB.prepare("SELECT data FROM app_records WHERE key LIKE 'integration:%' ORDER BY key").all<{data:string}>();
  return json({keys:rows.results.map(r=>publicKey(JSON.parse(r.data))),endpoints:{visitors:url.origin+'/api/integracao/visitantes',visits:url.origin+'/api/integracao/presencas'}});
 }
 if(url.pathname==='/api/integrations'&&req.method==='POST'){
  const b:any=await req.json();const name=typeof b?.name==='string'?b.name.trim():'';
  if(name.length<2||name.length>80)return json({error:'Informe um nome para a integração entre 2 e 80 caracteres.'},400);
  const id=crypto.randomUUID(),bytes=crypto.getRandomValues(new Uint8Array(32));
  const secret=Array.from(bytes,v=>v.toString(16).padStart(2,'0')).join('');
  const token='voe_'+id+'_'+secret;
  const key:Key={id,name,hash:await sha(token),created_at:new Date().toISOString(),created_by:user.id,revoked_at:null};
  await env.DB.prepare('INSERT INTO app_records(key,data) VALUES(?,?)').bind(prefix+id,JSON.stringify(key)).run();
  return json({key:publicKey(key),token},201);
 }
 const match=url.pathname.match(/^\/api\/integrations\/([a-f0-9-]{36})$/);
 if(match&&req.method==='DELETE'){
  const row=await env.DB.prepare('SELECT data,revision FROM app_records WHERE key=?').bind(prefix+match[1]).first<{data:string;revision:number}>();
  if(!row)return json({error:'Integração não encontrada.'},404);
  const key:Key=JSON.parse(row.data);
  if(!key.revoked_at){key.revoked_at=new Date().toISOString();const result=await env.DB.prepare('UPDATE app_records SET data=?,revision=revision+1 WHERE key=? AND revision=?').bind(JSON.stringify(key),prefix+match[1],row.revision).run();if(!result.meta.changes)return json({error:'Atualize a lista e tente novamente.'},409)}
  return json({ok:true});
 }
 return json({error:'Operação não permitida.'},405);
}
function validDate(value:string){return /^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value}
export async function integrationRead(req:Request,env:Env){
 if(req.method!=='GET')return json({error:'Esta integração permite somente consulta por GET.'},405);
 const url=new URL(req.url);
 if(!['/api/integracao/visitantes','/api/integracao/presencas'].includes(url.pathname))return json({error:'Endereço não encontrado.'},404);
 const token=req.headers.get('Authorization')?.match(/^Bearer (voe_([a-f0-9-]{36})_[a-f0-9]{64})$/);
 if(!token)return json({error:'Envie a chave no cabeçalho Authorization: Bearer.'},401);
 const row=await env.DB.prepare('SELECT data FROM app_records WHERE key=?').bind(prefix+token[2]).first<{data:string}>();
 const key:Key|null=row?JSON.parse(row.data):null;
 if(!key||key.revoked_at||key.hash!==await sha(token[1]))return json({error:'Chave inválida ou revogada.'},401);
 const params=url.searchParams;const start=params.get('inicio'),end=params.get('fim');
 const rawLimit=params.get('limite')||'50',cursor=params.get('cursor')||'';
 if(!/^\d+$/.test(rawLimit)||Number(rawLimit)<1||Number(rawLimit)>100||cursor.length>120||(start&&!validDate(start))||(end&&!validDate(end))||(start&&end&&start>end))return json({error:'Use datas AAAA-MM-DD, início anterior ao fim e limite entre 1 e 100.'},400);
 const limit=Number(rawLimit),isVisits=url.pathname.endsWith('/presencas');
 const conditions:string[]=[],args:(string|number)[]=[];
 if(isVisits){if(start){conditions.push('v.visit_date>=?');args.push(start)}if(end){conditions.push('v.visit_date<=?');args.push(end)}}
 else if(start||end){const clauses=['f.visitor_id=p.id'];if(start){clauses.push('f.visit_date>=?');args.push(start)}if(end){clauses.push('f.visit_date<=?');args.push(end)}conditions.push('EXISTS (SELECT 1 FROM visits f WHERE '+clauses.join(' AND ')+')')}
 if(cursor){conditions.push(isVisits?'v.id>?':'p.id>?');args.push(cursor)}
 const where=conditions.length?' WHERE '+conditions.join(' AND '):'';
 const sql=isVisits?'SELECT v.id,v.visitor_id AS visitante_id,v.visit_date AS data,v.created_at AS registrado_em FROM visits v'+where+' ORDER BY v.id LIMIT ?':
 'SELECT p.id,p.name AS nome,p.phone AS telefone,p.created_at AS cadastrado_em,p.updated_at AS atualizado_em,(SELECT COUNT(*) FROM visits f WHERE f.visitor_id=p.id) AS total_visitas,(SELECT MAX(visit_date) FROM visits f WHERE f.visitor_id=p.id) AS ultima_visita FROM visitors p'+where+' ORDER BY p.id LIMIT ?';
 const rows=(await env.DB.prepare(sql).bind(...args,limit+1).all<{id:string}>()).results;
 const hasMore=rows.length>limit;const data=rows.slice(0,limit);const next=hasMore?data[data.length-1].id:null;
 const nextUrl=new URL(url);if(next)nextUrl.searchParams.set('cursor',next);
 return json({versao:1,gerado_em:new Date().toISOString(),periodo:{inicio:start,fim:end},resumo:'Total de visitas e última visita consideram todo o histórico. O período seleciona presenças e visitantes com presença no período.',dados:data,paginacao:{limite:limit,proximo_cursor:next,proximo_link:next?nextUrl.toString():null}});
}
