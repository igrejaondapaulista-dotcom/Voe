import {spawn} from 'node:child_process';
import {readFileSync,writeFileSync,existsSync,unlinkSync} from 'node:fs';
import {createInterface} from 'node:readline/promises';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');process.chdir(root);
const cli=resolve(root,'node_modules/wrangler/bin/wrangler.js');
const run=(file,args,capture=false)=>new Promise((resolve,reject)=>{let out='';const child=spawn(process.execPath,[file,...args],{cwd:root,stdio:capture?['inherit','pipe','inherit']:'inherit'});if(capture)child.stdout.on('data',chunk=>{out+=chunk});child.on('error',reject);child.on('exit',code=>code===0?resolve(out):reject(Error('Etapa interrompida (código '+code+'). Corrija a mensagem acima e execute novamente.')))});
const wrangler=(args,capture=false)=>run(cli,args,capture);
async function ask(question){const rl=createInterface({input:process.stdin,output:process.stdout});try{return(await rl.question(question)).trim()}finally{rl.close()}}
try{
 if(!existsSync(cli))throw Error('Execute npm.cmd ci antes de publicar.');
 console.log('\nBASE — publicação na sua conta Cloudflare\n');
 await run(resolve(root,'node_modules/typescript/bin/tsc'),['--noEmit']);await run(resolve(root,'node_modules/vite/bin/vite.js'),['build']);
 let auth;try{auth=JSON.parse(await wrangler(['whoami','--json'],true))}catch{await wrangler(['login']);auth=JSON.parse(await wrangler(['whoami','--json'],true))}
 const config=JSON.parse(readFileSync('wrangler.jsonc','utf8'));
 const accounts=auth.accounts||[];
 if(!config.account_id&&accounts.length===1)config.account_id=accounts[0].id;
 if(!config.account_id&&accounts.length>1){console.log('Contas disponíveis:');accounts.forEach((a,i)=>console.log(`${i+1}. ${a.name}`));const choice=Number(await ask('Número da conta para hospedar BASE: '));if(!accounts[choice-1])throw Error('Conta inválida.');config.account_id=accounts[choice-1].id;}
 writeFileSync('wrangler.jsonc',JSON.stringify(config,null,2)+'\n');
 let binding=config.d1_databases.find(d=>d.binding==='DB');
 if(!binding.database_id||binding.database_id==='SUBSTITUA_PELO_ID_DO_BANCO'){
 console.log('Será criado um banco exclusivo para BASE. Se você já criou esse banco, informe o ID para reutilizá-lo.');
 const existing=await ask('ID do banco BASE existente (Enter para criar novo): ');
 if(existing){if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(existing))throw Error('ID inválido. Copie o ID do banco D1 de BASE.');binding.database_id=existing;}
 else{
 const output=await wrangler(['d1','create',binding.database_name],true);console.log(output);
 // Wrangler prints its binding configuration. Parse exactly database_id, never account IDs.
 const id=output.match(/(?:"database_id"|database_id)\s*[:=]\s*["']([0-9a-f-]{36})["']/i)?.[1];
 if(!id)throw Error('Copie o database_id exibido acima para wrangler.jsonc e execute novamente. O banco criado deve ser reutilizado.');binding.database_id=id;
 }
 writeFileSync('wrangler.jsonc',JSON.stringify(config,null,2)+'\n');
 }
 await wrangler(['d1','migrations','apply','DB','--remote']);
 if(existsSync('dados-iniciais.local.sql'))await wrangler(['d1','execute','DB','--remote','--file','dados-iniciais.local.sql']);
 const access=await wrangler(['d1','execute','DB','--remote','--command',"SELECT COUNT(*) AS total FROM users WHERE role='admin' AND active=1",'--json'],true);
 const data=JSON.parse(access);const total=data.flatMap(r=>r.results||[])[0]?.total;
 if(typeof total!=='number')throw Error('Não foi possível verificar o administrador. Nenhum acesso foi criado.');
 if(total===0){
 await run(resolve(root,'scripts/admin.mjs'),[]);
 try{await wrangler(['d1','execute','DB','--remote','--file','admin.local.sql'])}finally{if(existsSync('admin.local.sql'))unlinkSync('admin.local.sql')}
 }
 await wrangler(['deploy']);
 console.log('\nPublicação concluída. Abra o endereço HTTPS exibido acima e entre com seu acesso. Guarde wrangler.jsonc: ele identifica o banco e as próximas atualizações.\n');
}catch(e){console.error('\n'+e.message);process.exitCode=1}
