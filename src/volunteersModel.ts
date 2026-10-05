import {useSyncExternalStore} from 'react';
export type Volunteer={id:string;name:string;color:string;text:string};
export const volunteers:Volunteer[]=[];
export const colorPalette=[
 {color:'#1769a6',text:'#ffffff',name:'Azul'},
 {color:'#facbab',text:'#653b20',name:'Pêssego'},
 {color:'#fde99c',text:'#5e4d1e',name:'Amarelo'},
 {color:'#bce3f6',text:'#245b77',name:'Azul claro'},
 {color:'#e8eaed',text:'#30343a',name:'Cinza'},
 {color:'#117b4f',text:'#ffffff',name:'Verde'},
 {color:'#8a4b08',text:'#ffffff',name:'Marrom'},
 {color:'#b40000',text:'#ffffff',name:'Vermelho'},
 {color:'#e6c9f3',text:'#684580',name:'Lilás'},
 {color:'#ffd6e7',text:'#7a204c',name:'Rosa'},
 {color:'#d5f4ec',text:'#175d50',name:'Menta'},
 {color:'#ffdfb0',text:'#713f12',name:'Laranja claro'},
 {color:'#303958',text:'#ffffff',name:'Azul marinho'},
 {color:'#d9e2ff',text:'#33468c',name:'Lavanda azul'},
 {color:'#d9efb5',text:'#3d571b',name:'Verde claro'},
 {color:'#efb6b6',text:'#702727',name:'Coral'},
 {color:'#c7b7a3',text:'#44372a',name:'Areia'},
 {color:'#67428b',text:'#ffffff',name:'Roxo'},
 {color:'#2dd4bf',text:'#123d37',name:'Turquesa'},
 {color:'#164e63',text:'#ffffff',name:'Azul petróleo'},
 {color:'#59652b',text:'#ffffff',name:'Verde oliva'},
 {color:'#064e3b',text:'#ffffff',name:'Verde esmeralda'},
 {color:'#6b1839',text:'#ffffff',name:'Bordô'},
 {color:'#9c442f',text:'#ffffff',name:'Terracota'},
 {color:'#d1a32b',text:'#3e2b08',name:'Mostarda'},
 {color:'#b96d87',text:'#25111b',name:'Rosa antigo'},
 {color:'#000000',text:'#ffffff',name:'Preto'},
];
let version=0;
const listeners=new Set<()=>void>();
export function useVolunteerUpdates(){useSyncExternalStore(listener=>{listeners.add(listener);return()=>{listeners.delete(listener)}},()=>version,()=>version)}
export function colorAvailable(color:string,volunteerId?:string):boolean{
 const person=volunteers.find(v=>v.id===volunteerId);
 return !!colorPalette.find(c=>c.color===color)&&(person?.color===color||!volunteers.some(v=>v.id!==volunteerId&&v.color===color));
}
export function saveVolunteer(id:string,name:string,color:string){
 const palette=colorPalette.find(c=>c.color===color);
 if(!palette||!colorAvailable(color,id))throw Error('Essa cor já está em uso. Escolha uma cor disponível.');
 const current=volunteers.find(v=>v.id===id);
 if(current)Object.assign(current,{name,color,text:palette.text});
 else volunteers.push({id,name,color,text:palette.text});
 version++;listeners.forEach(listener=>listener());
}

export function replaceVolunteers(items:Volunteer[]){if(!Array.isArray(items))return;volunteers.splice(0,volunteers.length,...items);version++;listeners.forEach(listener=>listener());}
