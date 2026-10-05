export type AvailabilityAnswer='yes'|'no'|'maybe';
export type AvailabilityPoll={id:string;month:string;dates:string[];deadline:string;closed:boolean;responses:Record<string,Record<string,AvailabilityAnswer>>};
export function availabilityLabel(polls:AvailabilityPoll[],date:string,volunteerId:string):string{
 const poll=polls.find(p=>p.dates.includes(date));
 if(!poll)return 'Sem votação';
 const answer=poll.responses[volunteerId]?.[date];
 return answer?{yes:'Posso participar',no:'Não posso',maybe:'Ainda não sei'}[answer]:'Sem resposta';
}
export function sundays(month:string):string[]{
 if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw Error('Selecione um mês válido.');
 const [year,m]=month.split('-').map(Number);const dates:string[]=[];
 for(let d=new Date(Date.UTC(year,m-1,1));d.getUTCMonth()===m-1;d.setUTCDate(d.getUTCDate()+1))if(d.getUTCDay()===0)dates.push(d.toISOString().slice(0,10));
 return dates;
}
export function votingOpen(poll:AvailabilityPoll,now=Date.now()):boolean{return !poll.closed&&now<=Date.parse(poll.deadline+'T23:59:59-03:00');}
export function blankDates(existing:{date:string;people:string[]}[],dates:string[]){return [...existing.map(s=>({...s,people:[...s.people]})),...dates.filter(date=>!existing.some(s=>s.date===date)).map(date=>({date,people:['','','','','']}))].sort((a,b)=>a.date.localeCompare(b.date));}
