import {createRequire}from'node:module';import{readFileSync,readdirSync}from'node:fs';import assert from'node:assert/strict';import{pbkdf2Sync}from'node:crypto';
const require=createRequire(import.meta.url);const{Miniflare,convertV4MiniflareOptions}=require('miniflare');const{buildSync}=require('esbuild');const code=buildSync({entryPoints:['worker/index.ts'],bundle:true,write:false,format:'esm',platform:'browser'}).outputFiles[0].text;const mf=new Miniflare(convertV4MiniflareOptions({name:'onda',modules:true,script:code,compatibilityDate:'2026-10-03',d1Databases:['DB']}));const db=await mf.getD1Database('DB');for(const f of readdirSync('migrations').filter(f=>f.endsWith('.sql')).sort())await db.exec(readFileSync('migrations/'+f,'utf8').replace(/\n/g,' '));const rosterFixture=[{id:'test-a',name:'Voluntário de teste A',color:'#bce3f6',text:'#245b77'},{id:'test-b',name:'Voluntário de teste B',color:'#1769a6',text:'#ffffff'}];await db.prepare("UPDATE app_records SET data=?,revision=revision+1 WHERE key='volunteers'").bind(JSON.stringify(rosterFixture)).run();const shiftsFixture=Array.from({length:4},(_,i)=>({date:'2099-01-'+String(4+i*7).padStart(2,'0'),people:['test-a','','','','']}));for(const key of ['schedule:draft','schedule:published'])await db.prepare('UPDATE app_records SET data=?,revision=revision+1 WHERE key=?').bind(JSON.stringify(shiftsFixture),key).run();const salt='test';const hash=pbkdf2Sync('Test-only-123456!',salt,100000,32,'sha256').toString('hex');await db.prepare('INSERT INTO users(id,name,email,password_hash,salt,role) VALUES(?,?,?,?,?,?)').bind('admin','Admin','admin@example.test',hash,salt,'admin').run();let cookie='';
async function req(path,method='GET',body,expected=200){const r=await mf.dispatchFetch('https://onda.test/api'+path,{method,headers:{Origin:'https://onda.test',Cookie:cookie,'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});assert.equal(r.status,expected,await r.clone().text());return{data:await r.json(),cookie:r.headers.get('set-cookie')};}
await req('/visitors','GET',null,401);await req('/login','POST',{email:'admin@example.test',password:'wrong'},401);let login=await req('/login','POST',{email:'admin@example.test',password:'Test-only-123456!'});cookie=login.cookie.split(';')[0];assert(login.cookie.includes('HttpOnly'));assert(login.cookie.includes('Secure'));const adminCookie=cookie;
const a=(await req('/visitors','POST',{name:'Ana Teste',phone:'11999990001',consent:false},201)).data.id;const b=(await req('/visitors','POST',{name:'Visitante de teste B',phone:'11999990002',consent:true},201)).data.id;
await req('/visitors','POST',{name:'Duplicado',phone:'11999990001'},409);await req('/visitors','POST',{name:'Inválido',phone:'123'},400);await req('/visitors/'+a+'/visits','POST',{});await req('/visitors/'+a+'/visits','POST',{});assert.equal((await req('/visitors/'+a)).data.history.length,1);assert.equal((await req('/visitors?q=Ana')).data.visitors.length,1);assert.equal((await req('/visitors?q=999990002')).data.visitors[0].id,b);const dash=(await req('/dashboard')).data;assert.equal(dash.total,2);assert.equal(dash.today,2);assert.equal(dash.first,2);
await req('/visitors/'+a,'PUT',{name:'Ana Editada',phone:'11999990001',consent:true});assert((await req('/visitors/'+a)).data.visitor.consent_at);await req('/users','POST',{name:'Recepção','email':'recepcao@example.test',password:'Test-only-123456!',volunteer_id:'test-a',role:'reception',color:'#bce3f6'},201);login=await req('/login','POST',{email:'recepcao@example.test',password:'Test-only-123456!'});cookie=login.cookie.split(';')[0];await req('/users','GET',null,403);await req('/visitors/'+a,'DELETE',null,403);await req('/logout','POST',{});await req('/me','GET',null,401);cookie=adminCookie;await req('/visitors/'+a,'DELETE');assert.equal((await req('/dashboard')).data.today,1);assert.equal((await db.prepare('SELECT count(*) AS count FROM visits WHERE visitor_id=?').bind(a).first()).count,0);

// Full BASE backend: real D1 persistence, permissions and protected publication.
const seeded=(await req('/schedule')).data;assert.equal(seeded.shifts.length,4);assert(seeded.shifts.every(s=>s.people.length===5));
await req('/schedule','PUT',{shifts:seeded.shifts,revision:seeded.revision+99},409);
await req('/users','POST',{name:'Equipe de teste',email:'team@example.test',password:'12',role:'team',volunteer_id:'__new',color:'#000000'},400);
await req('/users','POST',{name:'Equipe de teste',email:'team@example.test',password:'123',role:'team',volunteer_id:'__new',color:'#000000'},201);
const roster=(await req('/users')).data;const joao=roster.users.find(u=>u.email==='team@example.test');assert.equal(roster.volunteers.find(v=>v.id===joao.volunteer_id).color,'#000000');
const teamLogin=await req('/login','POST',{email:'team@example.test',password:'123'});const teamCookie=teamLogin.cookie.split(';')[0];cookie=teamCookie;await req('/exports','GET',null,403);await req('/users','GET',null,403);
const poll=(await req('/availability','POST',{month:'2099-02',dates:['2099-02-01'],deadline:'2099-01-31'},201)).data.id;
// Feb 1, 2099 is a Sunday. Responses never assign a volunteer.
await req('/availability/'+poll+'/responses','PUT',{answers:{'2099-02-01':'yes'}});await req('/availability/'+poll+'/blank-schedule','POST',{});
let state=(await req('/schedule')).data;assert.deepEqual(state.shifts.find(s=>s.date==='2099-02-01').people,['','','','','']);assert(!state.published_shifts.some(s=>s.date==='2099-02-01'));
await req('/schedule/publish','POST',{month:'2099-02'});assert((await req('/schedule')).data.published_shifts.some(s=>s.date==='2099-02-01'));
const nid=(await req('/notices','POST',{title:'Encontro da equipe',body:'Chegar pela manhã.',pinned:true},201)).data.id;
await req('/notices/'+nid+'/like','PUT',{liked:true});await req('/notices/'+nid+'/like','PUT',{liked:true});assert.equal((await req('/notices')).data.notices[0].likes_count,1);
const volunteerLogin=await req('/login','POST',{email:'recepcao@example.test',password:'Test-only-123456!'});const volunteerCookie=volunteerLogin.cookie.split(';')[0];cookie=volunteerCookie;
await req('/notices','POST',{title:'Proibido',body:'Teste',pinned:false},403);await req('/notices?archived=1','GET',null,403);await req('/schedule','PUT',{shifts:state.shifts,revision:state.revision},403);
await req('/availability/'+poll+'/responses','PUT',{answers:{'2099-02-01':'maybe'}});assert.equal((await req('/availability')).data.polls.find(p=>p.id===poll).responses['test-a']['2099-02-01'],'maybe');
cookie=teamCookie;await req('/notices/'+nid+'/archive','PUT',{archived:true});await req('/notices/'+nid+'/like','PUT',{liked:true},409);await req('/notices/'+nid+'/archive','PUT',{archived:false});await req('/availability/'+poll+'/close','POST',{});await req('/availability/'+poll+'/responses','PUT',{answers:{'2099-02-01':'yes'}},409);
await req('/visitors/'+b+'/followup','PUT',{status:'contacted',note:'Contato registrado pela equipe.'});assert.equal((await req('/visitors/'+b)).data.visitor.followup.contacted_by,'Equipe de teste');assert.equal((await req('/visitors')).data.visitors[0].followup.status,'contacted');
cookie=adminCookie;const exported=(await req('/exports')).data;assert.equal(exported.mode,'production');assert.equal(exported.notices[0].likes.length,1);assert.equal(exported.availability[0].closed,true);assert(exported.volunteers.some(v=>v.color==='#000000'));assert(!JSON.stringify(exported).includes('password_hash'));assert(!JSON.stringify(exported).includes('Test-only-123456!'));
await req('/users/'+joao.id,'DELETE');cookie=teamCookie;await req('/me','GET',null,401);cookie=adminCookie;await req('/users/'+joao.id+'/reactivate','POST',{});assert.equal((await req('/login','POST',{email:'team@example.test',password:'123'})).data.user.role,'team');
// Duplicate email rejects the whole operation without adding a volunteer.
const beforeCount=(await req('/users')).data.volunteers.length;await req('/users','POST',{name:'Duplicado',email:'team@example.test',password:'123',role:'reception',volunteer_id:'__new',color:'#2dd4bf'},409);assert.equal((await req('/users')).data.volunteers.length,beforeCount);
const saved=await db.prepare("SELECT data FROM app_records WHERE key=?").bind('notice:'+nid).first();assert.equal(JSON.parse(saved.data).likes.length,1);
await assert.rejects(db.prepare("UPDATE app_records SET data='[]' WHERE key='volunteers'").run(),/STATE_CONFLICT/);

// Integration access is independent of session cookies and limited to visitor/presence reads.
cookie=(await req('/login','POST',{email:'team@example.test',password:'123'})).cookie.split(';')[0];await req('/integrations','GET',null,403);await req('/integrations','POST',{name:'Forbidden'},403);
cookie=volunteerCookie;await req('/integrations','GET',null,403);cookie=adminCookie;
await req('/integrations','POST',{name:'x'},400);
const integration=(await req('/integrations','POST',{name:'Sistema de teste'},201)).data;
assert(integration.token.startsWith('voe_'));assert(!JSON.stringify(integration.key).includes('hash'));
const keyList=(await req('/integrations')).data;assert.equal(keyList.keys.length,1);assert(!JSON.stringify(keyList).includes(integration.token));assert(!JSON.stringify(keyList).includes('hash'));
assert.equal(keyList.endpoints.visitors,'https://onda.test/api/integracao/visitantes');
const storedKey=JSON.parse((await db.prepare('SELECT data FROM app_records WHERE key=?').bind('integration:'+integration.key.id).first()).data);
assert.equal(storedKey.hash.length,64);assert(!JSON.stringify(storedKey).includes(integration.token));
async function external(path,token=integration.token,expected=200,method='GET'){
 const headers=token?{Authorization:'Bearer '+token}:{};
 const r=await mf.dispatchFetch('https://onda.test/api/integracao/'+path,{method,headers});
 assert.equal(r.status,expected,await r.clone().text());assert.equal(r.headers.get('Cache-Control'),'no-store');return r.json();
}
await external('visitantes',null,401);await external('visitantes',integration.token.slice(0,-1)+'x',401);
await external('visitantes?chave='+integration.token,null,401);
await req('/integracao/visitantes','GET',null,401); // An admin cookie alone never grants integration access.
await external('visitantes',integration.token,405,'DELETE');
await external('visitantes?limite=101',integration.token,400);await external('presencas?inicio=2026-02-30',integration.token,400);
await external('presencas?inicio=2026-10-31&fim=2026-10-01',integration.token,400);
await db.prepare('INSERT INTO visits(id,visitor_id,visit_date,created_by) VALUES(?,?,?,?)').bind('history-test-1',b,'2020-01-05','admin').run();
await db.prepare('INSERT INTO visits(id,visitor_id,visit_date,created_by) VALUES(?,?,?,?)').bind('history-test-2',b,'2020-02-02','admin').run();
const personData=await external('visitantes');assert.equal(personData.dados[0].id,b);assert.equal(personData.dados[0].total_visitas,3);assert.equal(personData.dados[0].nome,'Visitante de teste B');assert(!JSON.stringify(personData).includes('followup'));assert(!JSON.stringify(personData).includes('consent'));
let next='presencas?limite=1';const seen=[];
while(next){const page=await external(next);seen.push(...page.dados);next=page.paginacao.proximo_link?new URL(page.paginacao.proximo_link).pathname.split('/api/integracao/')[1]+new URL(page.paginacao.proximo_link).search:null;assert(seen.length<=3)}
assert.equal(seen.length,3);assert.equal(new Set(seen.map(v=>v.id)).size,3);assert(seen.every(v=>v.visitante_id===b));
const period=await external('presencas?inicio=2020-01-01&fim=2020-01-31');assert.equal(period.dados.length,1);assert.equal(period.dados[0].data,'2020-01-05');
assert.equal((await external('visitantes?inicio=2019-01-01&fim=2019-12-31')).dados.length,0);
assert.equal((await external('visitantes?inicio=2020-01-01&fim=2020-01-31')).dados[0].total_visitas,3);
// Existing feature writes must not modify key records; visitor edits and deletions appear on the next read.
await req('/visitors/'+b,'PUT',{name:'Visitante atualizado',phone:'11999990002',consent:true});assert.equal((await external('visitantes')).dados[0].nome,'Visitante atualizado');
await req('/notices/'+nid+'/like','PUT',{liked:true});assert.equal((await external('presencas')).dados.length,3);
await req('/visitors/'+b,'DELETE');assert.equal((await external('visitantes')).dados.length,0);assert.equal((await external('presencas')).dados.length,0);
assert(!JSON.stringify((await req('/exports')).data).includes(storedKey.hash));
await req('/integrations/'+integration.key.id,'DELETE');await external('visitantes',integration.token,401);await req('/integrations/'+integration.key.id,'DELETE');
assert((await req('/integrations')).data.keys[0].revoked_at);
console.log('PASS: integrações — perfis, hash sem chave no banco, chave obrigatória sem cookie/query, somente leitura, paginação, filtros, totais, alterações/exclusões e revogação.');
console.log('PASS: autenticação real, cadastros, D1, perfis, senha mínima 3, cores, escala e revisão concorrente, publicação, disponibilidade sem atribuição, avisos e curtidas idempotentes, acompanhamento, exportação sem senhas, desativação e reativação.');await mf.dispose();

