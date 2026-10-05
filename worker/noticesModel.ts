export type Notice={id:string;title:string;body:string;author:string;created_at:string;updated_at?:string;pinned:boolean;archived:boolean;likes:string[]};
export type NoticeView=Omit<Notice,'likes'>&{likes_count:number;liked:boolean};
export function sortNotices<T extends {pinned:boolean;created_at:string}>(items:T[]):T[]{return [...items].sort((a,b)=>Number(b.pinned)-Number(a.pinned)||b.created_at.localeCompare(a.created_at))}
