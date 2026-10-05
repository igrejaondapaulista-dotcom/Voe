import React,{useEffect,useState} from 'react';
import {CalendarDays} from 'lucide-react';
import {VolunteerSlots,type Shift} from './Schedule';

export default function NextShift({volunteerId,onOpen}:{volunteerId?:string;onOpen:()=>void}){
 const [shift,setShift]=useState<Shift|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState('');
 useEffect(()=>{let active=true;setLoading(true);setShift(null);setError('');fetch('/api/schedule/next').then(async r=>{const d:any=await r.json();if(!r.ok)throw Error(d.error);if(active)setShift(d.shift)}).catch(e=>{if(active)setError(e.message)}).finally(()=>{if(active)setLoading(false)});return()=>{active=false}},[volunteerId]);
 return <section className="panel next-shift"><div className="section-title"><h2>Minha próxima escala</h2><CalendarDays size={20}/></div>{loading?<p role="status" className="muted">Consultando a escala publicada…</p>:error?<p role="alert">{error}</p>:shift?<><p><strong>{new Date(shift.date+'T12:00:00').toLocaleDateString('pt-BR',{weekday:'long',day:'2-digit',month:'long'})}</strong> · Manhã</p><div className="shift-members"><VolunteerSlots people={shift.people} date={shift.date}/></div><p className="muted">Equipe da escala publicada. Toque em um nome para abrir no Google Agenda.</p></>:<p className="muted">{volunteerId?'Você ainda não está escalado nas próximas datas publicadas.':'Seu acesso precisa estar vinculado a um voluntário.'}</p>}<button onClick={onOpen}>Ver escala</button></section>;
}
