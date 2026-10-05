export interface Env { DB:D1Database; ASSETS:Fetcher }
export type User={id:string;name:string;email:string;role:string;volunteer_id?:string};
export const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export const hex=(b:ArrayBuffer)=>Array.from(new Uint8Array(b),v=>v.toString(16).padStart(2,'0')).join('');
export const sha=async(s:string)=>hex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)));
export async function password(s:string,salt:string){const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(s),'PBKDF2',false,['deriveBits']);return hex(await crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations:100000,hash:'SHA-256'},key,256));}
export function today(){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}
export function input(v:any){const name=String(v.name||'').trim();let phone=String(v.phone||'').replace(/\D/g,'');if(phone.length>11&&phone.startsWith('55'))phone=phone.slice(2);if(name.length<2||name.length>120)throw Error('Informe um nome entre 2 e 120 caracteres.');if(!/^\d{10,11}$/.test(phone))throw Error('Informe o telefone com DDD (10 ou 11 dígitos).');return {name,phone,consent:v.consent===true?1:0};}
