import {vi} from 'vitest';
import {createHouseDataProvider,type HouseRuntime} from '../../src/house';
type Draft=NonNullable<Awaited<ReturnType<HouseRuntime['roomDraft']['read']>>>;
const date='2026-10-01T00:00:00Z';
const initial=[
  ['categories',{id:'category',name:'Original'}],
  ['products',{id:'product',category_id:'category',reference:'PRINT',width:30,height:40,price:25,stock:8,sales:0,image:'',thumbnail:'',description:'Original description'}],
  ['customers',{id:'customer',first_name:'Ada',last_name:'Vale',email:'ada@example.test',first_seen:date,last_seen:date}],
] as const;
export function draftBoundary(){
  let state:unknown={};let revision=0;let race:(()=>void)|undefined;let available=true;let refusal:string|undefined;
  const drafts=new Map<string,Draft>();const listeners=new Set<(values:readonly Draft[])=>void>();
  const documents=initial.map(([resource,fields])=>({room:'r',path:`shop/${resource}/${fields.id}.md`,type:`shop_${resource==='categories'?'category':resource==='products'?'product':'customer'}`,fields:{...fields} as Record<string,unknown>,markdown:JSON.stringify(fields)}));
  const publish=()=>{for(const listener of listeners)listener([...drafts.values()]);};
  const attachments: {reference:string;name:string;byteLength:number;mediaType:string|null;entry:unknown}[]=[];
  const methods={
    rooms:vi.fn(async()=>[{locator:'r',name:'Shop',attachments:structuredClone(attachments)}]),
    call:vi.fn(async()=>{throw new Error('Save must not invoke a Provider Action');}),
    query:vi.fn(async()=>({documents:structuredClone(documents)})),
    observe:vi.fn(async(topic:string)=>topic==='room-drafts'?{current:()=>[...drafts.values()],subscribe:(fn:(values:readonly Draft[])=>void)=>{listeners.add(fn);return()=>listeners.delete(fn);},close:vi.fn()}:{current:()=> 'write-halted',subscribe:()=>()=>{},close:vi.fn()}),
    presentation:{read:vi.fn(async()=>structuredClone(state)),write:vi.fn(async(value:unknown)=>{state=structuredClone(value);})},
    roomDraft:{read:vi.fn(async(_room:string,path:string)=>structuredClone(drafts.get(path)??null)),write:vi.fn(async(room:string,path:string,base:string|null,parts:Draft['parts'])=>{
      if(race){const run=race;race=undefined;run();}
      const current=drafts.get(path);if((current?.revision??null)!==base)return{outcome:'stale',current:structuredClone(current??null)};
      let next=structuredClone(parts);if(next.fields)for(const [key,part] of Object.entries(next.fields)){const old=current?.parts.fields?.[key];if(old)next={...next,fields:{...next.fields,[key]:{...part,base:old.base}}};}
      const draft={room,path,revision:`d${++revision}`,parts:next,changedUnderneath:current?.changedUnderneath??{},returned:current?.returned??null};drafts.set(path,draft);publish();return{outcome:'written',roomDraft:structuredClone(draft)};
    }),discard:vi.fn()},
    save:vi.fn(async(_room:string,entries:{path:string;revision:string}[])=>{
      if(refusal)return{outcome:'refused',rule:refusal};
      if(entries.some(entry=>drafts.get(entry.path)?.revision!==entry.revision))return{outcome:'refused',rule:'stale'};
      for(const entry of entries){const draft=drafts.get(entry.path)!;const creation=draft.parts.creation;
        if(creation&&'fields' in creation){if(documents.some(doc=>doc.path===entry.path))return{outcome:'refused',rule:'exists'};documents.push({room:'r',path:entry.path,type:creation.type,fields:{...creation.fields},markdown:JSON.stringify(creation.fields)});}
        else {const doc=documents.find(doc=>doc.path===entry.path)!;for(const [key,part] of Object.entries(draft.parts.fields??{}))doc.fields[key]=part.value;doc.markdown=JSON.stringify(doc.fields);}
        drafts.delete(entry.path);
      }publish();return{outcome:'saved',identifier:'waiting-locally'};
    }),
  };
  const md=methods as unknown as HouseRuntime;const provider=createHouseDataProvider(md,'r',{isAvailable:()=>available});
  return{md,provider,methods,drafts,documents,attachments,available:(value:boolean)=>{available=value;},refuse:(value:string|undefined)=>{refusal=value;},race:(run:()=>void)=>{race=run;},remote:(path:string,fields:NonNullable<Draft['parts']['fields']>)=>{const old=drafts.get(path)!;drafts.set(path,{...old,revision:`d${++revision}`,parts:{...old.parts,fields:{...old.parts.fields,...fields}}});publish();}};
}
