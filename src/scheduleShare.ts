export function scheduleShareText(shifts:{date:string;people:string[]}[],month:string,people:{id:string;name:string}[],version?:number):string{
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw Error('Selecione um mês válido.');
 const dates=shifts.filter(s=>s.date.startsWith(month)).sort((a,b)=>a.date.localeCompare(b.date));
 if(!dates.length)throw Error('Não há datas publicadas neste mês para compartilhar.');
 const monthLabel=new Date(month+'-01T12:00:00Z').toLocaleDateString('pt-BR',{month:'long',year:'numeric',timeZone:'UTC'});
 const heading=['*BASE · Igreja Onda*',`*Escala — ${monthLabel}*`,`Escala publicada${version?` · versão ${version}`:''}`, 'Período da manhã'];
 const blocks=dates.map(s=>{const date=new Date(s.date+'T12:00:00Z').toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric',weekday:'long',timeZone:'UTC'});const names=s.people.filter(Boolean).map(id=>people.find(p=>p.id===id)?.name||'Voluntário');const free=Math.max(0,5-names.length);return [`*${date}*`,...names.map(name=>'• '+name),...(free?[`Vagas livres: ${free}`]:[])].join('\n')});
 return [...heading,'',blocks.join('\n\n'),'','Viva o extraordinário.'].join('\n');
}
export function whatsappScheduleUrl(text:string):string{return 'https://wa.me/?text='+encodeURIComponent(text)}
