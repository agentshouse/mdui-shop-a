// @vitest-environment node
import {expect,it} from 'vitest';
import {draftBoundary} from './support/business-drafts';
const productInput={category_id:'category',reference:'NEW',width:20,height:30,price:15,stock:1,image:'',thumbnail:''};
it('retains incomplete actual product fields locally across reopen, then consumes exactly the validated draft on Save',async()=>{
  const {provider,drafts,methods}=draftBoundary();const first=await provider.openDraft('products',undefined,productInput);
  await first.write({reference:'Typed title',width:'-'});expect(methods.save).not.toHaveBeenCalled();expect(methods.query).not.toHaveBeenCalled();first.close();
  const second=await provider.openDraft('products',undefined,{});expect(second.values()).toMatchObject({reference:'Typed title',width:'-'});
  let prepared=await second.prepare();await expect(provider.create('products',{data:prepared.data,meta:{houseDraft:prepared.reference}})).rejects.toThrow('width');expect(drafts.size).toBe(1);
  await second.write({width:22});prepared=await second.prepare();const writes=methods.roomDraft.write.mock.calls.length;
  const result=await provider.create('products',{data:{...prepared.data,reference:'Stale submit value'},meta:{houseDraft:prepared.reference}});
  expect(result.data.reference).toBe('Typed title');expect(methods.roomDraft.write).toHaveBeenCalledTimes(writes);expect(methods.save).toHaveBeenCalledWith('r',[prepared.reference]);expect(drafts.size).toBe(0);second.close();
});
it('merges disjoint fields and same-field stale typing while preserving first opened bases and redrawing other tabs',async()=>{
  const {provider,drafts,methods,remote,race}=draftBoundary();const {data}=await provider.getOne('products',{id:'product'});
  const first=await provider.openDraft('products',data,data);await first.write({description:'First edit'});const second=await provider.openDraft('products',data,data);
  await second.write({price:29});race(()=>remote(data._house.path,{description:{value:'Other tab',base:{value:'Original description'}}}));
  await first.write({description:'Latest typing'});expect(second.values()).toMatchObject({price:29,description:'Latest typing'});
  expect(drafts.get(data._house.path)?.parts.fields?.description.base).toEqual({value:'Original description'});
  const prepared=await first.prepare();await provider.update('products',{id:data.id,previousData:data,data:{...data,price:99},meta:{houseDraft:prepared.reference}});
  expect(methods.save).toHaveBeenCalledWith('r',[prepared.reference]);expect((await provider.getOne('products',{id:'product'})).data).toMatchObject({price:29,description:'Latest typing',stock:8});first.close();second.close();
});
it('preserves a draft changed after preparation and a provider-refused Save without overwriting or discarding either',async()=>{
  const {provider,drafts,methods,remote,refuse}=draftBoundary();const {data}=await provider.getOne('categories',{id:'category'});
  const session=await provider.openDraft('categories',data,data);await session.write({name:'Local'});const prepared=await session.prepare();remote(data._house.path,{name:{value:'Other tab',base:{value:'Original'}}});
  await expect(provider.update('categories',{id:data.id,previousData:data,data:prepared.data,meta:{houseDraft:prepared.reference}})).rejects.toThrow('shared draft changed');expect(methods.save).not.toHaveBeenCalled();
  const latest=await session.prepare();refuse('changed-underneath');await expect(provider.update('categories',{id:data.id,previousData:data,data:latest.data,meta:{houseDraft:latest.reference}})).rejects.toThrow('kept');
  expect(drafts.get(data._house.path)?.parts.fields?.name.value).toBe('Other tab');expect(methods.roomDraft.discard).not.toHaveBeenCalled();session.close();
});
it('keeps later edits at an old creation pointer intact and transitions an already open creation after another tab saves',async()=>{
  const {provider,drafts,methods}=draftBoundary();const first=await provider.openDraft('products',undefined,productInput);await first.write({reference:'Shared creation'});
  const second=await provider.openDraft('products',undefined,{});const prepared=await first.prepare();const {data}=await provider.create('products',{data:prepared.data,meta:{houseDraft:prepared.reference}});
  await second.write({reference:'After peer Save'});const editing=await second.prepare();expect(editing.existing).toBe(true);expect(drafts.get(data._house.path)?.parts.creation).toBeUndefined();
  expect(drafts.get(data._house.path)?.parts.fields?.reference.base).toEqual({value:'Shared creation'});
  const held=structuredClone(drafts.get(data._house.path));const next=await provider.openDraft('products',undefined,productInput);await next.write({reference:'Distinct next product'});expect(drafts.size).toBe(2);expect(drafts.get(data._house.path)).toEqual(held);
  await provider.update('products',{id:data.id,data:editing.data,previousData:editing.previousData,meta:{houseDraft:editing.reference}});expect(methods.save).toHaveBeenCalledTimes(2);first.close();second.close();next.close();
});
it('allows local draft typing and Save during provider halt but preserves lost-reach and other draft guards',async()=>{
  const {provider,methods,drafts,available}=draftBoundary();const {data}=await provider.getOne('categories',{id:'category'});const session=await provider.openDraft('categories',data,data);
  await session.write({name:'While halted'});const prepared=await session.prepare();available(false);await expect(provider.update('categories',{id:data.id,data:prepared.data,previousData:data,meta:{houseDraft:prepared.reference}})).rejects.toThrow('binding');expect(drafts.size).toBe(1);expect(methods.save).not.toHaveBeenCalled();available(true);
  await provider.update('categories',{id:data.id,data:prepared.data,previousData:data,meta:{houseDraft:prepared.reference}});expect(methods.save).toHaveBeenCalledOnce();session.close();
});

it('validates image references against local Room metadata without a Provider Action, including while write-halted',async()=>{
  const {provider,methods,drafts,attachments}=draftBoundary();
  const first=await provider.openDraft('products',undefined,productInput);
  await first.write({image:'at_declared',thumbnail:'at_declared'});
  const prepared=await first.prepare();
  await expect(provider.create('products',{data:prepared.data,meta:{houseDraft:prepared.reference}})).rejects.toThrow('not declared in the selected Room');
  expect(drafts.size).toBe(1);expect(methods.save).not.toHaveBeenCalled();expect(methods.call).not.toHaveBeenCalled();
  attachments.push({reference:'at_declared',name:'poster.jpg',byteLength:128,mediaType:'image/jpeg',entry:{}});
  const result=await provider.create('products',{data:prepared.data,meta:{houseDraft:prepared.reference}});
  expect(result.data.image).toBe('at_declared');expect(methods.save).toHaveBeenCalledWith('r',[prepared.reference]);
  expect(methods.rooms).toHaveBeenCalledTimes(2);expect(methods.call).not.toHaveBeenCalled();expect(drafts.size).toBe(0);first.close();
});

it('does not submit an older draft when the latest local typing write failed',async()=>{
  const {provider,methods,drafts}=draftBoundary();const {data}=await provider.getOne('categories',{id:'category'});
  const session=await provider.openDraft('categories',data,data);await session.write({name:'Earlier local value'});
  methods.roomDraft.write.mockRejectedValueOnce(new Error('Local draft unavailable'));
  await expect(session.write({name:'Newest input'})).rejects.toThrow('Local draft unavailable');
  await expect(session.prepare()).rejects.toThrow('latest input has not reached its local Room Draft');
  expect(methods.save).not.toHaveBeenCalled();expect(session.values().name).toBe('Newest input');
  expect(drafts.get(data._house.path)?.parts.fields?.name.value).toBe('Earlier local value');
  await session.write({name:'Newest input'});const prepared=await session.prepare();
  await provider.update('categories',{id:data.id,previousData:data,data:prepared.data,meta:{houseDraft:prepared.reference}});
  expect((await provider.getOne('categories',{id:'category'})).data.name).toBe('Newest input');session.close();
});
