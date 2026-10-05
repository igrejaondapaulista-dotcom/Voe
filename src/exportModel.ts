export type ExportData={schema_version:number;app:string;app_version:string;generated_at:string;timezone:string;mode:string;visitors:any[];visits:any[];volunteers:any[];users:any[];schedule_draft:{date:string;people:string[]}[];schedule_published:{date:string;people:string[]}[];publications:Record<string,{version?:number;at?:string;by?:string}>;availability:any[];notices:any[]};
export type ExportKind='visitors'|'visits'|'schedule'|'availability'|'volunteers';
export type ExportOptions={month:string;start:string;end:string;phase:'both'|'draft'|'published'};
export const exportKinds={visitors:'Visitantes e acompanhamento',visits:'Histórico de visitas',schedule:'Escala',availability:'Disponibilidade',volunteers:'Voluntários e suas cores'};
export function csvCell(value:unknown):string{
 let text=value==null?'':String(value);
 // Impede que campos livres sejam executados como fórmulas pela planilha.
 if(/^\s*[=+@-]/.test(text)||/^[\t\r\n]/.test(text))text="'"+text;
 return '"'+text.replaceAll('"','""')+'"';
}
export function csvText(rows:unknown[][]):string{return '\uFEFF'+rows.map(row=>row.map(csvCell).join(';')).join('\r\n')+'\r\n'}
export function exportRows(data:ExportData,kind:ExportKind,options:ExportOptions):unknown[][]{
 const name=(id:string)=>data.volunteers.find(v=>v.id===id)?.name||id;
 if(kind==='visitors')return [['ID','Nome','Telefone','Aceita WhatsApp','Consentimento em','Visitas','Última visita','Acompanhamento','Observação','Contato em','Contato por','Atualizado em','Atualizado por'],...data.visitors.map(v=>{const visits=data.visits.filter(x=>x.visitor_id===v.id);return [v.id,v.name,v.phone,v.consent?'Sim':'Não',v.consent_at,visits.length,visits.map(x=>x.visit_date).sort().at(-1),v.followup?.status==='contacted'?'Contato realizado':'Contato pendente',v.followup?.note,v.followup?.contacted_at,v.followup?.contacted_by,v.followup?.updated_at,v.followup?.updated_by]})];
 if(kind==='visits')return [['Data','Visitante ID','Nome','Telefone','Recebido por'],...data.visits.filter(v=>v.visit_date>=options.start&&v.visit_date<=options.end).sort((a,b)=>a.visit_date.localeCompare(b.visit_date)).map(v=>{const person=data.visitors.find(p=>p.id===v.visitor_id);return [v.visit_date,v.visitor_id,person?.name,person?.phone,v.receptionist]})];
 if(kind==='volunteers')return [['ID','Nome','Cor','Cor do texto'],...data.volunteers.map(v=>[v.id,v.name,v.color,v.text])];
 if(kind==='schedule'){
 const phases=options.phase==='both'?['draft','published']: [options.phase];
 return [['Data','Período','Situação da escala','Versão publicada','Publicado em','Publicado por','Vaga','Voluntário ID','Nome','Situação da vaga'],...phases.flatMap(phase=>(phase==='draft'?data.schedule_draft:data.schedule_published).filter(s=>s.date.startsWith(options.month)).sort((a,b)=>a.date.localeCompare(b.date)).flatMap(s=>Array.from({length:5},(_,index)=>{const id=s.people[index]||'',p=phase==='published'?data.publications[options.month]:undefined;return [s.date,'Manhã',phase==='draft'?'Rascunho':'Publicada',p?.version,p?.at,p?.by,index+1,id,id?name(id):'Vaga livre',id?'Preenchida':'Livre']})))];
 }
 const labels:Record<string,string>={yes:'Posso participar',no:'Não posso',maybe:'Ainda não sei'};
 return [['Mês','Data','Prazo','Votação','Voluntário ID','Nome','Resposta'],...data.availability.filter(p=>p.month===options.month).flatMap(p=>p.dates.flatMap((date:string)=>data.volunteers.map(v=>[p.month,date,p.deadline,p.closed||Date.now()>Date.parse(p.deadline+'T23:59:59-03:00')?'Encerrada':'Aberta',v.id,v.name,labels[p.responses[v.id]?.[date]]||'Sem resposta'])))];
}
export function exportFilename(kind:ExportKind,options:ExportOptions,today:string):string{
 const names={visitors:'visitantes',visits:'visitas',schedule:'escala',availability:'disponibilidade',volunteers:'voluntarios'};
 const suffix=kind==='visits'?options.start+'-a-'+options.end:kind==='schedule'||kind==='availability'?options.month:today;
 return `BASE-${names[kind]}-${suffix}.csv`;
}
