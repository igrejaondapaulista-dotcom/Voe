import {pbkdf2Sync,randomUUID} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {createInterface} from 'node:readline/promises';
async function ask(question){const rl=createInterface({input:process.stdin,output:process.stdout});try{return(await rl.question(question)).trim()}finally{rl.close()}}
async function hiddenPassword(){
 if(!process.stdin.isTTY)throw Error('Execute este comando em um terminal interativo.');
 process.stdout.write('Senha (mínimo 3 caracteres; entrada oculta): ');
 let pass='';process.stdin.setRawMode(true);process.stdin.resume();
 return await new Promise((resolve,reject)=>{
 const done=(error)=>{process.stdin.off('data',onData);process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write('\n');error?reject(error):resolve(pass)};
 const onData=chunk=>{for(const ch of chunk.toString()){if(ch==='\u0003'){done(Error('Cadastro cancelado.'));return}if(ch==='\r'||ch==='\n'){done();return}if(ch==='\u007f'||ch==='\b')pass=pass.slice(0,-1);else pass+=ch}};
 process.stdin.on('data',onData);
 });
}
try{
 const name=await ask('Nome do administrador: '),email=(await ask('E-mail: ')).toLowerCase(),pass=await hiddenPassword();
 if(pass.length<3||pass.length>1024||name.length<2||name.length>120||!/^\S+@\S+\.\S+$/.test(email))throw Error('Informe nome, e-mail válido e senha de pelo menos 3 caracteres.');
 const salt=randomUUID(),hash=pbkdf2Sync(pass,salt,100000,32,'sha256').toString('hex'),esc=s=>"'"+s.replaceAll("'","''")+"'";
 writeFileSync('admin.local.sql',`INSERT INTO users(id,name,email,password_hash,salt,role,role_v2,volunteer_id) VALUES(${[randomUUID(),name,email,hash,salt,'admin','admin'].map(esc).join(',')},NULL);\n`,{mode:0o600});
 console.log('Administrador preparado. A senha foi protegida com hash. Aplique admin.local.sql com Wrangler e apague o arquivo após concluir.');
}catch(e){console.error(e.message);process.exitCode=1}
