import React,{useEffect,useRef,useState} from 'react';
import {LayoutDashboard,UserPlus,Users,CalendarDays,Check,ShieldCheck,Ellipsis,Megaphone,Download} from 'lucide-react';

const primaryTabs=[
  {key:'dashboard',label:'Visão geral',Icon:LayoutDashboard},
  {key:'new',label:'Nova visita',Icon:UserPlus},
  {key:'visitors',label:'Visitantes',Icon:Users},
  {key:'schedule',label:'Escala',Icon:CalendarDays},
  {key:'availability',label:'Disponibilidade',Icon:Check},
];

export default function Navigation({tab,role,onNavigate}:{tab:string;role:string;onNavigate:(tab:string)=>void}){
  const [open,setOpen]=useState(false);
  const container=useRef<HTMLDivElement>(null);
  const trigger=useRef<HTMLButtonElement>(null);
  const firstOption=useRef<HTMLButtonElement>(null);
  const extraTabs=[{key:'notices',label:'Avisos',Icon:Megaphone},...(role==='admin'?[{key:'team',label:'Equipe',Icon:ShieldCheck},{key:'exports',label:'Exportar dados',Icon:Download}]:[])];
  useEffect(()=>{setOpen(false)},[tab,role]);
  useEffect(()=>{
    if(!open)return;
    firstOption.current?.focus();
    const outside=(event:PointerEvent)=>{if(!container.current?.contains(event.target as Node))setOpen(false)};
    const keyboard=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();setOpen(false);trigger.current?.focus()}};
    const focusOutside=(event:FocusEvent)=>{if(!container.current?.contains(event.target as Node))setOpen(false)};
    document.addEventListener('pointerdown',outside);
    document.addEventListener('keydown',keyboard);
    document.addEventListener('focusin',focusOutside);
    return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',keyboard);document.removeEventListener('focusin',focusOutside)};
  },[open]);
  const navigate=(key:string)=>{setOpen(false);onNavigate(key)};
  return <nav className={`app-navigation ${extraTabs.length?'has-more':''}`} aria-label="Navegação principal">
    {primaryTabs.map(({key,label,Icon})=><button key={key} className={tab===key||(key==='visitors'&&tab==='detail')?'active':''} aria-current={tab===key||(key==='visitors'&&tab==='detail')?'page':undefined} onClick={()=>navigate(key)}><Icon size={20}/><span>{label}</span></button>)}
    {!!extraTabs.length&&<div className="nav-more" ref={container}>
      <button ref={trigger} className={open||extraTabs.some(item=>item.key===tab)?'active':''} aria-label="Mais opções" aria-expanded={open} aria-controls="navigation-more" onClick={()=>setOpen(value=>!value)}><Ellipsis size={22}/><span>Mais</span></button>
      {open&&<div className="nav-more-panel" id="navigation-more" aria-label="Mais opções de navegação">{extraTabs.map(({key,label,Icon},index)=><button key={key} ref={index===0?firstOption:undefined} aria-current={tab===key?'page':undefined} className={tab===key?'active':''} onClick={()=>navigate(key)}><Icon size={20}/><span>{label}</span></button>)}</div>}
    </div>}
  </nav>;
}
