import {colorPalette,type Volunteer} from './palette';
import {sundays,votingOpen,blankDates,type AvailabilityPoll} from './availabilityModel';
import {sortNotices,type Notice} from './noticesModel';
import {password,type User,type Env,today} from './security';
type Shift={date:string;people:string[]};
export async function featureApi(req:Request,env:Env,current:User):Promise<Response|null>{
 const u=new URL(req.url),p=u.pathname.slice(4),method=req.method;
 if(!/^\/(notices|availability|schedule|users|exports|volunteers)(\/|$)/.test(p))return null;
 const b:any=['GET','HEAD','DELETE'].includes(method)?{}:await req.json();
 if(!b||typeof b!=='object'||Array.isArray(b))return Response.json({error:'Dados inválidos.'},{status:400});
 const validDate=(d:string)=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d;
 const rows=(await env.DB.prepare('SELECT * FROM app_records').all<any>()).results;
 const recordMap=new Map<string,any>(rows.map(r=>[r.key,r]));
 const get=(key:string,fallback:any)=>recordMap.has(key)?JSON.parse(recordMap.get(key).data):fallback;
 const volunteers:Volunteer[]=get('volunteers',[]);
 let schedule:Shift[]=get('schedule:draft',[]),published:Shift[]=get('schedule:published',[]);
 const publications:Record<string,{version:number;at:string;by:string}>=get('schedule:publications',{});
 const polls:AvailabilityPoll[]=rows.filter(r=>r.key.startsWith('poll:')).map(r=>JSON.parse(r.data));
 const notices:Notice[]=rows.filter(r=>r.key.startsWith('notice:')).map(r=>JSON.parse(r.data));
 const rawUsers=(await env.DB.prepare('SELECT * FROM users ORDER BY name').all<any>()).results;
 const users:any[]=rawUsers.map(u=>({...u,role:u.role_v2||u.role}));
 const beforeUsers=new Map(users.map(u=>[u.id,JSON.stringify(u)]));
 const passwords=new Map<string,string>();
 const publicUser=(u:any)=>({id:u.id,name:u.name,email:u.email,role:u.role,volunteer_id:u.volunteer_id,active:u.active});
 const colorAvailable=(color:string,id?:string)=>!!colorPalette.find(c=>c.color===color)&&(volunteers.find(v=>v.id===id)?.color===color||!volunteers.some(v=>v.id!==id&&v.color===color));
 const saveVolunteer=(id:string,name:string,color:string)=>{const palette=colorPalette.find(c=>c.color===color)!;const v=volunteers.find(v=>v.id===id);if(v)Object.assign(v,{name,color,text:palette.text});else volunteers.push({id,name,color,text:palette.text});};
 const monthSnapshot=(list:Shift[],month:string)=>list.filter(s=>s.date.startsWith(month)).sort((a,b)=>a.date.localeCompare(b.date));
 const publicationSummary=()=>Object.fromEntries([...new Set([...schedule.map(s=>s.date.slice(0,7)),...published.map(s=>s.date.slice(0,7)),...Object.keys(publications)])].map(month=>[month,{...publications[month],dirty:JSON.stringify(monthSnapshot(schedule,month))!==JSON.stringify(monthSnapshot(published,month))}]));
 const day=today();
 const people:any[]=p==='/exports'&&current.role==='admin'?(await env.DB.prepare('SELECT v.*,f.data AS followup_json FROM visitors v LEFT JOIN visitor_followup f ON f.visitor_id=v.id').all<any>()).results.map(v=>({...v,followup:v.followup_json?JSON.parse(v.followup_json):null})):[];
 const visits:any[]=p==='/exports'&&current.role==='admin'?(await env.DB.prepare('SELECT v.*,u.name AS receptionist FROM visits v JOIN users u ON u.id=v.created_by').all<any>()).results:[];
 const response=(data:any,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
 const execute=async():Promise<Response>=>{
 if(p==='/volunteers'&&method==='GET')return response({volunteers});
 const manager=['admin','team'].includes(current.role);
 const reactionId=current.volunteer_id||current.id;
 const noticeView=(n:Notice)=>{const {likes,...item}=n;return {...item,likes_count:likes.length,liked:likes.includes(reactionId)}};
 if(p==='/notices'){
 if(method==='GET'){
 const archived=u.searchParams.get('archived')==='1';if(archived&&!manager)return response({error:'Somente a equipe consulta os avisos arquivados.'},403);
 return response({notices:sortNotices(notices.filter(n=>n.archived===archived)).map(noticeView)});
 }
 if(method==='POST'){
 if(!manager)return response({error:'Somente a equipe autorizada pode publicar avisos.'},403);
 if(typeof b.title!=='string'||b.title.trim().length<2||b.title.length>120||typeof b.body!=='string'||!b.body.trim()||b.body.length>3000||typeof b.pinned!=='boolean')return response({error:'Informe título, mensagem e a opção de fixar.'},400);
 const item:Notice={id:crypto.randomUUID(),title:b.title.trim(),body:b.body.trim(),author:current.name,created_at:new Date().toISOString(),pinned:b.pinned,archived:false,likes:[]};notices.push(item);return response({id:item.id},201);
 }
 }
 const nm=p.match(/^\/notices\/([^/]+)(\/(like|archive))?$/);
 if(nm){
 const item=notices.find(n=>n.id===nm[1]);if(!item)return response({error:'Aviso não encontrado.'},404);
 if(nm[3]==='like'&&method==='PUT'){
 if(item.archived)return response({error:'Este aviso está arquivado.'},409);
 if(typeof b.liked!=='boolean')return response({error:'Curtida inválida.'},400);
 item.likes=item.likes.filter(id=>id!==reactionId);if(b.liked)item.likes.push(reactionId);return response({notice:noticeView(item)});
 }
 if(!manager)return response({error:'Somente a equipe autorizada pode alterar avisos.'},403);
 if(nm[3]==='archive'&&method==='PUT'){
 if(typeof b.archived!=='boolean')return response({error:'Situação inválida.'},400);
 item.archived=b.archived;return response({ok:true});
 }
 if(!nm[3]&&method==='PUT'){
 if(item.archived)return response({error:'Restaure o aviso antes de editar.'},409);
 if(typeof b.title!=='string'||b.title.trim().length<2||b.title.length>120||typeof b.body!=='string'||!b.body.trim()||b.body.length>3000||typeof b.pinned!=='boolean')return response({error:'Verifique o título e a mensagem.'},400);
 Object.assign(item,{title:b.title.trim(),body:b.body.trim(),pinned:b.pinned,updated_at:new Date().toISOString()});return response({ok:true});
 }
 }
 if(p==='/availability'){
 if(method==='GET')return response({polls});
 if(method==='POST'){
 if(!manager)return response({error:'Somente a equipe autorizada pode abrir votações.'},403);
 let options:string[];try{options=sundays(b.month)}catch{return response({error:'Selecione um mês válido.'},400)}
 if(polls.some(p=>p.month===b.month))return response({error:'Já existe uma votação para este mês.'},409);
 if(!Array.isArray(b.dates)||!b.dates.length||b.dates.some((d:string)=>!options.includes(d))||new Set(b.dates).size!==b.dates.length||!validDate(b.deadline)||Date.parse(b.deadline+'T23:59:59-03:00')<Date.now())return response({error:'Escolha as datas e um prazo válido, a partir de hoje.'},400);
 const poll:AvailabilityPoll={id:crypto.randomUUID(),month:b.month,dates:[...b.dates].sort(),deadline:b.deadline,closed:false,responses:{}};polls.push(poll);return response({id:poll.id},201);
 }
 }
 const pm=p.match(/^\/availability\/([^/]+)\/(responses|close|blank-schedule)$/);
 if(pm){const poll=polls.find(p=>p.id===pm[1]);if(!poll)return response({error:'Votação não encontrada.'},404);
 if(pm[2]==='responses'&&method==='PUT'){
 if(!votingOpen(poll))return response({error:'O prazo desta votação terminou.'},409);
 if(!current.volunteer_id||!volunteers.some(v=>v.id===current.volunteer_id))return response({error:'Seu acesso não está vinculado a um voluntário.'},403);
 const answers=b.answers;if(!answers||typeof answers!=='object'||Array.isArray(answers)||!Object.keys(answers).length||Object.entries(answers).some(([date,value])=>!poll.dates.includes(date)||!['yes','no','maybe'].includes(String(value))))return response({error:'Verifique suas respostas.'},400);
 poll.responses[current.volunteer_id]={...answers};return response({ok:true});
 }
 if(!manager)return response({error:'Somente a equipe autorizada pode alterar a escala ou encerrar votações.'},403);
 if(pm[2]==='close'&&method==='POST'){poll.closed=true;return response({ok:true});}
 if(pm[2]==='blank-schedule'&&method==='POST'){const previous=schedule.length;schedule=blankDates(schedule,poll.dates);return response({added:schedule.length-previous});}
 }
 if(p==='/schedule'){
 if(method==='PUT'&&b.revision!==recordMap.get('schedule:draft')?.revision)return response({error:'A escala foi alterada por outra pessoa. Atualize a página antes de salvar.'},409);
 if(method==='GET')return response({shifts:manager?schedule:published,published_shifts:published,revision:recordMap.get('schedule:draft')?.revision||0,publications:manager?publicationSummary():publications});
 if(method==='PUT'){
 if(!manager)return response({error:'Somente a equipe autorizada pode editar a escala.'},403);
 const shifts=b.shifts;if(!Array.isArray(shifts)||shifts.length>500||shifts.some((s:any)=>!validDate(s.date)||!Array.isArray(s.people)||s.people.length>5||new Set(s.people.filter(Boolean)).size!==s.people.filter(Boolean).length||s.people.some((id:string)=>id!==''&&!volunteers.some(v=>v.id===id)))||new Set(shifts.map((s:any)=>s.date)).size!==shifts.length)return response({error:'Verifique as datas e os voluntários da escala.'},400);
 schedule=shifts.map((s:any)=>({date:s.date,people:Array.from({length:5},(_,i)=>s.people[i]||'')}));return response({ok:true});
 }
 }
 if(p==='/schedule/publish'&&method==='POST'){
 if(!manager)return response({error:'Somente a equipe autorizada pode publicar a escala.'},403);
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(b.month))return response({error:'Selecione um mês válido.'},400);
 const dates=monthSnapshot(schedule,b.month);
 if(!dates.length&&!published.some(s=>s.date.startsWith(b.month)))return response({error:'Adicione datas antes de publicar.'},400);
 published=[...published.filter(s=>!s.date.startsWith(b.month)),...dates.map(s=>({...s,people:[...s.people]}))];
 publications[b.month]={version:(publications[b.month]?.version||0)+1,at:new Date().toISOString(),by:current.name};
 return response({ok:true,publications:publicationSummary()});
 }
 if(p==='/schedule/next'&&method==='GET'){
 const next=published.filter(s=>s.date>=day&&s.people.includes(current.volunteer_id||'')).sort((a,b)=>a.date.localeCompare(b.date))[0];
 return response({shift:next||null,publication:next?publications[next.date.slice(0,7)]:null});
 }
 if(p==='/exports'){
 if(current.role!=='admin')return response({error:'Exportação exclusiva do administrador.'},403);
 if(method!=='GET')return response({error:'Método não permitido.'},405);
 return response({schema_version:1,app:'BASE — Recepção Onda',app_version:'1.0.0',mode:'production',timezone:'America/Sao_Paulo',generated_at:new Date().toISOString(),
 visitors:people.map(v=>({id:v.id,name:v.name,phone:v.phone,consent:v.consent,consent_at:v.consent_at,followup:v.followup?{status:v.followup.status,note:v.followup.note,contacted_at:v.followup.contacted_at,contacted_by:v.followup.contacted_by,updated_at:v.followup.updated_at,updated_by:v.followup.updated_by}:null})),
 visits:visits.map(v=>({visitor_id:v.visitor_id,visit_date:v.visit_date,receptionist:v.receptionist})),
 volunteers:volunteers.map(v=>({id:v.id,name:v.name,color:v.color,text:v.text})),users:users.map(publicUser),
 schedule_draft:schedule.map(s=>({date:s.date,people:[...s.people]})),schedule_published:published.map(s=>({date:s.date,people:[...s.people]})),publications,
 availability:polls.map(p=>({id:p.id,month:p.month,dates:[...p.dates],deadline:p.deadline,closed:p.closed,responses:p.responses})),
 notices:notices.map(n=>({id:n.id,title:n.title,body:n.body,author:n.author,created_at:n.created_at,updated_at:n.updated_at,pinned:n.pinned,archived:n.archived,likes:[...n.likes]}))});
 }
 if(p==='/users'){
 if(current.role!=='admin')return response({error:'Acesso exclusivo do administrador.'},403);
 if(method==='GET')return response({users:users.map(publicUser),volunteers});
 if(method==='POST'){
 const email=String(b.email||'').trim().toLowerCase(),name=String(b.name||'').trim();
 const isNew=b.volunteer_id==='__new',person=volunteers.find(v=>v.id===b.volunteer_id),color=b.color||person?.color;
 if(name.length<2||name.length>120||!/^\S+@\S+\.\S+$/.test(email)||typeof b.password!=='string'||(b.password.length<3||b.password.length>1024)||!['team','reception'].includes(b.role)||(!isNew&&!person))return response({error:'Informe nome, e-mail, senha de pelo menos 3 caracteres, perfil e voluntário.'},400);
 if(users.some(x=>x.email===email))return response({error:'E-mail já cadastrado.'},409);
 if(!isNew&&users.some(x=>x.volunteer_id===b.volunteer_id&&x.active&&x.role!=='admin'))return response({error:'Esse voluntário já tem um acesso ativo. Desative o anterior para substituí-lo.'},409);
 if(!colorAvailable(color,person?.id))return response({error:'Escolha uma cor disponível. As cores atuais foram preservadas.'},409);
 const volunteerId=isNew?crypto.randomUUID():person!.id;saveVolunteer(volunteerId,name,color);
 const account={id:crypto.randomUUID(),name,email,role:b.role,volunteer_id:volunteerId,active:1};users.push(account);passwords.set(account.id,b.password);return response({ok:true},201);
 }
 }
 const reactivate=p.match(/^\/users\/([^/]+)\/reactivate$/);
 if(reactivate&&method==='POST'){
 if(current.role!=='admin')return response({error:'Acesso exclusivo do administrador.'},403);
 const account=users.find(x=>x.id===reactivate[1]);if(!account)return response({error:'Acesso não encontrado.'},404);
 if(account.active===1)return response({ok:true});
 if(!account.volunteer_id||!volunteers.some(v=>v.id===account.volunteer_id))return response({error:'Vincule este acesso a um voluntário antes de reativar.'},409);
 if(users.some(x=>x.id!==account.id&&x.active===1&&x.role!=='admin'&&x.volunteer_id===account.volunteer_id))return response({error:'Este voluntário já tem outro acesso ativo. Desative o outro acesso antes de reativar este.'},409);
 account.active=1;return response({ok:true});
 }
 const um=p.match(/^\/users\/([^/]+)$/);
 if(um&&method==='PUT'){
 if(current.role!=='admin')return response({error:'Acesso exclusivo do administrador.'},403);
 const account=users.find(x=>x.id===um[1]);if(!account)return response({error:'Acesso não encontrado.'},404);
 if(account.role==='admin')return response({error:'Este formulário é para acessos de voluntários e equipe.'},403);
 const email=String(b.email||'').trim().toLowerCase(),name=String(b.name||'').trim();
 if(name.length<2||name.length>120||!/^\S+@\S+\.\S+$/.test(email)||!['team','reception'].includes(b.role)||!volunteers.some(v=>v.id===b.volunteer_id)||(b.password&&(typeof b.password!=='string'||(b.password.length<3||b.password.length>1024))))return response({error:'Verifique os dados do acesso.'},400);
 if(users.some(x=>x.id!==account.id&&x.email===email))return response({error:'E-mail já cadastrado.'},409);
 if(account.active&&users.some(x=>x.id!==account.id&&x.active&&x.role!=='admin'&&x.volunteer_id===b.volunteer_id))return response({error:'Esse voluntário já tem outro acesso ativo.'},409);
 const person=volunteers.find(v=>v.id===b.volunteer_id)!;const color=b.color||person.color;
 if(!colorAvailable(color,person.id))return response({error:'Essa cor já está em uso. Escolha uma cor disponível.'},409);
 saveVolunteer(person.id,name,color);
 Object.assign(account,{name,email,role:b.role,volunteer_id:b.volunteer_id});if(b.password)passwords.set(account.id,b.password);return response({ok:true});
 }
 if(um&&method==='DELETE'){
 if(current.role!=='admin')return response({error:'Acesso exclusivo do administrador.'},403);
 const account=users.find(x=>x.id===um[1]);if(!account)return response({error:'Acesso não encontrado.'},404);
 if(account.id===current.id||account.role==='admin')return response({error:'O acesso do administrador deve permanecer ativo.'},409);
 account.active=0;return response({ok:true});
 }

 return response({error:'Operação não encontrada.'},404);
 };
 const result=await execute();
 if(!result.ok||['GET','HEAD'].includes(method))return result;
 const after=new Map<string,string>([['volunteers',JSON.stringify(volunteers)],['schedule:draft',JSON.stringify(schedule)],['schedule:published',JSON.stringify(published)],['schedule:publications',JSON.stringify(publications)],...polls.map(p=>['poll:'+p.id,JSON.stringify(p)] as [string,string]),...notices.map(n=>['notice:'+n.id,JSON.stringify(n)] as [string,string])]);
 const statements:D1PreparedStatement[]=[];
 for(const [key,data] of after){const old=recordMap.get(key);if(old?.data===data)continue;statements.push(old?env.DB.prepare('UPDATE app_records SET data=?,revision=? WHERE key=?').bind(data,old.revision+1,key):env.DB.prepare('INSERT INTO app_records(key,data) VALUES(?,?)').bind(key,data));}
 for(const user of users){
 const previous=beforeUsers.get(user.id);if(previous===JSON.stringify(user)&&!passwords.has(user.id))continue;
 let salt=user.salt,hash=user.password_hash;
 if(passwords.has(user.id)){salt=crypto.randomUUID();hash=await password(passwords.get(user.id)!,salt);}
 if(previous)statements.push(env.DB.prepare('UPDATE users SET name=?,email=?,role_v2=?,volunteer_id=?,active=?,password_hash=?,salt=?,revision=? WHERE id=?').bind(user.name,user.email,user.role,user.volunteer_id||null,user.active,hash,salt,user.revision+1,user.id));
 else statements.push(env.DB.prepare('INSERT INTO users(id,name,email,password_hash,salt,role,role_v2,volunteer_id,active) VALUES(?,?,?,?,?,?,?,?,?)').bind(user.id,user.name,user.email,hash,salt,'reception',user.role,user.volunteer_id||null,user.active));
 if(previous&&(user.active===0||passwords.has(user.id)))statements.push(env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(user.id));
 }
 if(statements.length)await env.DB.batch(statements);
 return result;
}
