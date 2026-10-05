import {scheduleShareText,whatsappScheduleUrl} from './scheduleShare';
import React,{useEffect,useState} from 'react';
import {availabilityLabel,type AvailabilityPoll} from './availabilityModel';
import {CalendarDays,Plus,Trash2,Pencil,Copy,Check,X,MessageCircle} from 'lucide-react';
import {volunteers,useVolunteerUpdates} from './volunteersModel';
export {volunteers} from './volunteersModel';
export type Shift={date:string;people:string[]};
export const initialSchedule:Shift[]=[];
async function request(method='GET',body?:unknown){const r=await fetch('/api/schedule',{method,headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined});const d:any=await r.json();if(!r.ok)throw Error(d.error);return d;}
type Draft={mode:'edit'|'copy'|'new';originalDate:string;date:string;people:string[]};
export function prepareChange(shifts:Shift[],draft:Draft):Shift[]{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(draft.date)||!Number.isFinite(Date.parse(draft.date))||new Date(draft.date+'T12:00:00Z').toISOString().slice(0,10)!==draft.date)throw Error('Informe uma data válida.');
 if(shifts.some(s=>s.date===draft.date&&(draft.mode!=='edit'||s.date!==draft.originalDate)))throw Error('Essa data já tem uma escala. Escolha outra data.');
 const people=[...draft.people];
 const chosen=people.filter(Boolean);
 if(people.length>5||new Set(chosen).size!==chosen.length||chosen.some(id=>!volunteers.some(v=>v.id===id)))throw Error('Selecione até cinco voluntários, sem repetir nomes.');
 const shift={date:draft.date,people:[...people]};
 if(draft.mode==='edit'){
  if(!shifts.some(s=>s.date===draft.originalDate))throw Error('A escala original não foi encontrada.');
  return shifts.map(s=>s.date===draft.originalDate?shift:{...s,people:[...s.people]});
 }
 return [...shifts.map(s=>({...s,people:[...s.people]})),shift];
}
export function fillVacancy(shifts:Shift[],date:string,index:number,personId:string):Shift[]{
 const shift=shifts.find(s=>s.date===date);
 if(!shift||!Number.isInteger(index)||index<0||index>=5)throw Error('Vaga não encontrada.');
 if(shift.people[index])throw Error('Essa vaga já foi preenchida.');
 if(!volunteers.some(v=>v.id===personId))throw Error('Escolha um voluntário.');
 if(shift.people.includes(personId))throw Error('Esse voluntário já está escalado nesta data.');
 return shifts.map(s=>{const people=[...s.people];if(s.date===date){while(people.length<5)people.push('');people[index]=personId;}return {...s,people}});
}
export function googleCalendarLink(date:string,personName:string,people:string[]):string{
 const start=new Date(date+'T00:00:00Z');
 if(!Number.isFinite(start.getTime())||start.toISOString().slice(0,10)!==date)throw Error('Data inválida para o Google Agenda.');
 const end=new Date(start);end.setUTCDate(end.getUTCDate()+1);
 const team=people.map(id=>volunteers.find(v=>v.id===id)?.name).filter(Boolean).join(', ');
 const url=new URL('https://calendar.google.com/calendar/render');
 url.searchParams.set('action','TEMPLATE');
 url.searchParams.set('text',`BASE — Recepção — ${personName}`);
 url.searchParams.set('dates',date.replaceAll('-','')+'/'+end.toISOString().slice(0,10).replaceAll('-',''));
 url.searchParams.set('details',`Igreja Onda — BASE\nPeríodo da manhã. Sem horário exato definido.\nVoluntário: ${personName}\nEquipe escalada: ${team}\nViva o extraordinário.`);
 url.searchParams.set('location','Igreja Onda');
 return url.toString();
}
export function calendarLaunchLink(date:string,personName:string,people:string[],userAgent:string):string{
 const web=googleCalendarLink(date,personName,people);
 if(!/Android/i.test(userAgent))return web;
 // Tentativa direta acionada pelo toque; o Chrome resolve o app ou o fallback HTTPS.
 const destination=new URL(web);
 return `intent://${destination.host}${destination.pathname}${destination.search}#Intent;scheme=https;action=android.intent.action.VIEW;package=com.google.android.calendar;S.browser_fallback_url=${encodeURIComponent(web)};end`;
}
export function VolunteerSlots({people,date,onFreeSlot,disabled=false}:{people:string[];date:string;onFreeSlot?:(index:number)=>void;disabled?:boolean}){
 useVolunteerUpdates();
 const userAgent=typeof navigator==='undefined'?'':navigator.userAgent;
 return <>{Array.from({length:5},(_,i)=>{const v=volunteers.find(person=>person.id===people[i]);const href=v?calendarLaunchLink(date,v.name,people,userAgent):'';return v?<a key={i} className="volunteer-chip volunteer-calendar" style={{background:v.color,color:v.text}} href={href} target={href.startsWith('intent:')?'_self':'_blank'} rel="noopener noreferrer" title={`Adicionar a escala de ${v.name} ao Google Agenda`} aria-label={`${v.name}: abrir escala de ${new Date(date+'T12:00:00').toLocaleDateString('pt-BR')} no Google Agenda`}><span>{v.name}</span><CalendarDays size={13} aria-hidden="true"/></a>:onFreeSlot?<button type="button" key={i} className="volunteer-chip free-slot vacancy-button" disabled={disabled} aria-label={`Preencher vaga ${i+1} de ${new Date(date+'T12:00:00').toLocaleDateString('pt-BR')}`} onClick={()=>onFreeSlot(i)}>Vaga livre</button>:<span key={i} className="volunteer-chip free-slot">Vaga livre</span>})}</>;
}
export default function Schedule({canEdit}:{canEdit:boolean}){
 useVolunteerUpdates();
 const [revision,setRevision]=useState(0);
 const [shifts,setShifts]=useState<Shift[]>([]),[publishedShifts,setPublishedShifts]=useState<Shift[]>([]),[month,setMonth]=useState('2026-10'),[draft,setDraft]=useState<Draft|null>(null),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState(''),[vacancy,setVacancy]=useState<{date:string;index:number;selected:string}|null>(null),[publications,setPublications]=useState<Record<string,{version?:number;at?:string;by?:string;dirty?:boolean}>>({}),[polls,setPolls]=useState<AvailabilityPoll[]>([]),[availabilityError,setAvailabilityError]=useState('');
 useEffect(()=>{let live=true;request().then(d=>{if(live){setRevision(d.revision);setShifts(d.shifts);setPublishedShifts(d.published_shifts||[]);setPublications(d.publications||{})}}).catch(e=>{if(live)setError(e.message)}).finally(()=>{if(live)setLoading(false)});return()=>{live=false}},[]);
 useEffect(()=>{if(!canEdit)return;let live=true;fetch('/api/availability').then(async r=>{const d:any=await r.json();if(!r.ok)throw Error(d.error);if(live)setPolls(d.polls)}).catch(e=>{if(live)setAvailabilityError(e.message)});return()=>{live=false}},[canEdit]);
 useEffect(()=>{if(!draft&&!vacancy)return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue=''};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn)},[draft,vacancy]);
 useEffect(()=>{
 if(!vacancy)return;
 const previous=document.activeElement as HTMLElement|null;
 const dialog=document.querySelector<HTMLElement>('.vacancy-dialog');
 dialog?.querySelector<HTMLElement>('button:not(:disabled)')?.focus();
 const keys=(e:KeyboardEvent)=>{
  if(e.key==='Escape'&&!busy){setVacancy(null);setError('');return;}
  if(e.key!=='Tab'||!dialog)return;
  const controls=Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled)'));
  if(!controls.length)return;
  const first=controls[0],last=controls[controls.length-1];
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
  else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
 };
 window.addEventListener('keydown',keys);
 return()=>{window.removeEventListener('keydown',keys);previous?.focus()};
 },[vacancy?.date,vacancy?.index,busy]);
 async function save(next:Shift[],message:string){setBusy(true);setError('');setNotice('');try{await request('PUT',{shifts:next,revision});setShifts(next);const d=await request();setRevision(d.revision);setShifts(d.shifts);setPublishedShifts(d.published_shifts||[]);setPublications(d.publications||{});setNotice(message+' Alteração salva no rascunho.');return true}catch(e){setError(e instanceof Error?e.message:'Não foi possível atualizar.');return false}finally{setBusy(false)}}
 function start(mode:Draft['mode'],shift?:Shift){setError('');setNotice('');setDraft({mode,originalDate:shift?.date||'',date:mode==='edit'?shift!.date:'',people:shift?[...shift.people]:['']})}
 const visible=shifts.filter(s=>s.date.startsWith(month)).sort((a,b)=>a.date.localeCompare(b.date));
 const publication=publications[month];
 const availability=(date:string,id:string)=>{if(availabilityError)return 'Consulta indisponível';return availabilityLabel(polls,date,id)};
 const count=(id:string)=>visible.filter(s=>s.people.includes(id)).length;
 async function publish(){setBusy(true);setError('');setNotice('');try{const r=await fetch('/api/schedule/publish',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({month})});const d:any=await r.json();if(!r.ok)throw Error(d.error);setPublications(d.publications);const latest=await request();setPublishedShifts(latest.published_shifts||[]);setNotice('Escala publicada. Os voluntários já podem consultar esta versão.')}catch(e){setError(e instanceof Error?e.message:'Não foi possível publicar.')}finally{setBusy(false)}}
 const hasPublished=publishedShifts.some(s=>s.date.startsWith(month));
 const shareUrl=hasPublished?whatsappScheduleUrl(scheduleShareText(publishedShifts,month,volunteers,publication?.version)):'';
 const formatDate=(d:string)=>new Date(d+'T12:00:00').toLocaleDateString('pt-BR');
 return <><div className="heading"><div><p className="eyebrow">VOLUNTÁRIOS</p><h1>Escala</h1><p>Quem vai acolher em cada data. Cada voluntário mantém sua cor.</p></div><label className="month-picker">Mês<input type="month" aria-label="Mês da escala" disabled={busy||!!draft||!!vacancy} value={month} onChange={e=>setMonth(e.target.value)}/></label></div>
 {error&&<div role="alert" className="alert error">{error}</div>}{notice&&<div role="status" className="alert success">{notice}</div>}
 <section className="panel publication-panel"><div><strong>{canEdit?(publication?.dirty?'Rascunho com alterações':publication?.version?'Escala publicada · sem alterações pendentes':'Rascunho · ainda não publicado'):'Escala publicada'}</strong><p className="muted">{canEdit?'Salvar mantém as mudanças no rascunho. Publicar atualiza a escala que os voluntários consultam.':'Você está consultando a versão publicada pela equipe.'}</p>{publication?.version&&<small>Versão {publication.version} · {publication.by} · {publication.at?new Date(publication.at).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'}):''}</small>}</div>{canEdit&&<button className="primary" disabled={loading||busy||!!draft||!!vacancy||(!visible.length&&!publication?.version)||(!publication?.dirty&&!!publication?.version)} onClick={()=>{const vacancies=visible.reduce((n,s)=>n+5-s.people.filter(Boolean).length,0);if(confirm(`Publicar a escala de ${month.split('-').reverse().join('/')}? ${vacancies} vaga(s) continuará(ão) livre(s).`))void publish()}}>Publicar escala</button>}</section>
 <section className="schedule-share"><div>{hasPublished&&!busy?<a className="whatsapp-share" href={shareUrl} target="_blank" rel="noopener noreferrer"><MessageCircle size={19}/>Compartilhar no WhatsApp</a>:<button className="whatsapp-share" disabled><MessageCircle size={19}/>Compartilhar no WhatsApp</button>}<small>{hasPublished?'Compartilha as datas e os nomes da escala publicada do mês. Escolha a conversa no WhatsApp e confirme o envio.':'Publique datas neste mês para compartilhar a escala.'}</small>{canEdit&&publication?.dirty&&<small>O rascunho tem alterações. O compartilhamento usa a versão publicada anterior.</small>}</div></section>
 {vacancy&&canEdit&&<div className="vacancy-overlay"><section role="dialog" aria-modal="true" aria-labelledby="vacancy-title" className="vacancy-dialog"><h2 id="vacancy-title">Preencher vaga livre</h2><p className="muted">{formatDate(vacancy.date)} · Vaga {vacancy.index+1}</p><p>Escolha um voluntário e confirme em Salvar. A disponibilidade não preenche vagas automaticamente.</p>{availabilityError&&<p role="alert" className="muted">Não foi possível consultar a disponibilidade. Você pode continuar a escolha manual.</p>}{error&&<div role="alert" className="alert error">{error}</div>}<div className="vacancy-options" aria-label="Voluntários disponíveis">{volunteers.map((v,i)=>{const assigned=shifts.find(s=>s.date===vacancy.date)?.people.includes(v.id);return <button type="button" key={v.id} autoFocus={i===0} disabled={busy||assigned} aria-pressed={vacancy.selected===v.id} style={{background:v.color,color:v.text}} onClick={()=>setVacancy({...vacancy,selected:v.id})}><span><span>{v.name} <span className="volunteer-count" aria-label={`${count(v.id)} escalas no mês`}>{count(v.id)}</span></span><small>{assigned?'Já escalado nesta data':availability(vacancy.date,v.id)}</small></span>{vacancy.selected===v.id&&<Check size={19} aria-hidden="true"/>}</button>})}</div><div className="vacancy-footer"><button className="primary" disabled={busy||!vacancy.selected} onClick={async()=>{try{const next=fillVacancy(shifts,vacancy.date,vacancy.index,vacancy.selected);if(await save(next,'Vaga preenchida.'))setVacancy(null)}catch(e){setError(e instanceof Error?e.message:'Não foi possível preencher a vaga.')}}}>{busy?'Salvando…':'Salvar'}</button><button disabled={busy} onClick={()=>{setVacancy(null);setError('');setNotice('Seleção cancelada. A vaga continua livre.')}}>Cancelar</button></div></section></div>}
 <section className="panel volunteer-legend"><h2>Voluntários e suas cores</h2><div className="volunteer-chips">{volunteers.map(v=><span className="volunteer-chip" key={v.id} style={{background:v.color,color:v.text}} aria-label={`${v.name}: ${visible.filter(s=>s.people.includes(v.id)).length} escalas no mês selecionado`}><span>{v.name}</span><span className="volunteer-count" aria-hidden="true">{loading?'—':visible.filter(s=>s.people.includes(v.id)).length}</span></span>)}</div></section>
 {draft&&canEdit&&<section className="panel shift-editor" aria-labelledby="editor-title"><div className="section-title"><h2 id="editor-title">{draft.mode==='edit'?'Editar escala':draft.mode==='copy'?'Duplicar escala':'Nova escala'}</h2><span>Alterações pendentes</span></div><p className="muted">{draft.mode==='copy'?`Copiando os voluntários de ${formatDate(draft.originalDate)}. Escolha a nova data; a escala original será mantida.`:'Revise a data e os voluntários. As alterações só são aplicadas ao salvar.'}</p>
 <form onSubmit={async e=>{e.preventDefault();try{const next=prepareChange(shifts,draft);const targetDate=draft.date;const message=draft.mode==='copy'?'Escala duplicada. A original foi mantida.':draft.mode==='new'?'Nova escala criada.':'Alterações da escala salvas.';if(await save(next,message)){setMonth(targetDate.slice(0,7));setDraft(null)}}catch(e){setError(e instanceof Error?e.message:'Verifique os dados.')}}}>
 <label className="editor-date">{draft.mode==='copy'?'Nova data':'Data da escala'}<input type="date" required autoFocus disabled={busy} value={draft.date} onChange={e=>setDraft({...draft,date:e.target.value})}/></label>
 <div className="editor-people">{draft.people.map((id,i)=>{const v=volunteers.find(x=>x.id===id);return <div className="editor-person" key={i}><label>Voluntário {i+1}<select aria-label={`Voluntário ${i+1}`} disabled={busy} style={{background:v?.color||'#f0ebf7',color:v?.text||'#776987'}} value={id} onChange={e=>setDraft({...draft,people:draft.people.map((p,index)=>index===i?e.target.value:p)})}><option value="">Selecione um voluntário</option>{volunteers.map(person=><option key={person.id} value={person.id} disabled={draft.people.includes(person.id)&&person.id!==id} style={{background:person.color,color:person.text}}>{person.name} · {draft.date?availability(draft.date,person.id):'Escolha uma data'} · {shifts.filter(s=>s.date.startsWith(draft.date.slice(0,7)||month)&&s.people.includes(person.id)).length}</option>)}</select></label><button type="button" disabled={busy} aria-label={`Remover voluntário ${i+1}`} onClick={()=>setDraft({...draft,people:draft.people.filter((_,index)=>index!==i)})}><X size={18}/></button></div>})}</div>
 <div><button type="button" disabled={busy||draft.people.length>=5} onClick={()=>setDraft({...draft,people:[...draft.people,'']})}><Plus size={18}/>Adicionar voluntário</button><small className="editor-limit">Até cinco voluntários por data.</small></div>
 <div className="editor-actions"><button className="primary" disabled={busy}><Check size={18}/>{busy?'Salvando…':'Salvar escala'}</button><button type="button" disabled={busy} onClick={()=>{setDraft(null);setError('');setNotice('Edição cancelada. A escala foi mantida.')}}>Cancelar</button></div>
 </form></section>}
 <section className="panel schedule-panel"><div className="section-title"><h2>Escala por data</h2><span><CalendarDays size={16}/>{visible.length} data(s)</span></div><p className="muted">{canEdit?'Use os ícones para ajustar as datas e os nomes. Depois, publique o mês para atualizar a escala dos voluntários.':'Consulte os voluntários de cada data publicada.'}</p><p className="muted">Clique no nome escolhido para abrir no Google Agenda. Período da manhã; confirme em Salvar no Agenda.</p>
 <div className="shift-list">{visible.map(s=><article className="shift shift-readonly" key={s.date}><div className="shift-date"><CalendarDays size={21}/><span><strong>{formatDate(s.date)}</strong><small>{new Date(s.date+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'long'})}</small></span></div><div className="shift-members"><VolunteerSlots people={s.people} date={s.date} disabled={busy||!!draft||!!vacancy} onFreeSlot={canEdit?(index)=>{setError('');setNotice('');setVacancy({date:s.date,index,selected:''})}:undefined}/></div>{canEdit&&<div className="shift-actions"><button disabled={busy||!!draft||!!vacancy} onClick={()=>start('edit',s)} title="Editar" aria-label={`Editar escala de ${formatDate(s.date)}`}><Pencil size={18}/></button><button disabled={busy||!!draft||!!vacancy} onClick={()=>start('copy',s)} title="Duplicar" aria-label={`Duplicar escala de ${formatDate(s.date)}`}><Copy size={18}/></button><button className="shift-delete" aria-label={`Excluir escala de ${formatDate(s.date)}`} disabled={busy||!!draft||!!vacancy} onClick={()=>{if(confirm('Excluir a escala de '+formatDate(s.date)+'?'))void save(shifts.filter(x=>x.date!==s.date),'Escala excluída.')}}><Trash2 size={17}/></button></div>}</article>)}</div>
 {loading&&<p role="status" className="muted">Carregando escala…</p>}{!loading&&!visible.length&&<div className="empty"><CalendarDays size={32}/><h3>Nenhuma escala neste mês</h3><p>{canEdit?'Adicione uma data para organizar os voluntários.':'A equipe ainda não publicou datas para este mês.'}</p></div>}
 {canEdit&&<div className="add-shift"><button className="primary" disabled={loading||busy||!!draft||!!vacancy} onClick={()=>start('new')}><Plus size={18}/>Adicionar data</button></div>}
 </section></>;
}
