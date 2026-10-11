import {useEffect} from 'react';
import {act,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {FormProvider,useForm} from 'react-hook-form';
import {beforeEach,expect,it,vi} from 'vitest';
import {BusinessDraft} from '../src/BusinessDraft';
import {parseBusinessNumber} from '../src/BusinessNumberInput';
import {draftBoundary} from './support/business-drafts';
const fixture=vi.hoisted(()=>({provider:{} as any,record:undefined as any,middleware:undefined as any}));
vi.mock('react-admin',()=>({
  useDataProvider:()=>fixture.provider,useRecordContext:()=>fixture.record,useResourceContext:()=> 'products',
  useRegisterMutationMiddleware:(fn:any)=>useEffect(()=>{fixture.middleware=fn;},[fn]),
}));
const defaults={category_id:'category',reference:'NEW',width:30,height:40,price:25,stock:8,sales:0,image:'',thumbnail:''};
function Form({label='Reference'}:{label?:string}){const form=useForm({defaultValues:fixture.record??defaults});return <FormProvider {...form}><BusinessDraft/><input aria-label={label} {...form.register('reference')}/><input aria-label={`${label} width`} {...form.register('width',{setValueAs:parseBusinessNumber})}/></FormProvider>;}
beforeEach(()=>{fixture.provider=draftBoundary().provider;fixture.record=undefined;fixture.middleware=undefined;});
it('restores incomplete business inputs after navigation and redraws another tab on shared input',async()=>{
  const {provider,drafts,methods}=draftBoundary();fixture.provider=provider;const first=render(<Form/>);
  fireEvent.change(screen.getByLabelText('Reference'),{target:{value:'Keep before leaving'}});fireEvent.change(screen.getByLabelText('Reference width'),{target:{value:'-'}});
  await waitFor(()=>expect(methods.presentation.write).toHaveBeenCalled());first.unmount();render(<><Form label="First"/><Form label="Second"/></>);
  await waitFor(()=>expect(screen.getByLabelText('First')).toHaveValue('Keep before leaving'));await waitFor(()=>expect(screen.getByLabelText('Second width')).toHaveValue('-'));
  fireEvent.change(screen.getByLabelText('First'),{target:{value:'Shared latest input'}});await waitFor(()=>expect(screen.getByLabelText('Second')).toHaveValue('Shared latest input'));
  expect(drafts.size).toBe(1);expect(methods.save).not.toHaveBeenCalled();expect(methods.roomDraft.discard).not.toHaveBeenCalled();
});
it('finishes typing-time local writes even if navigation wins the initial lookup race',async()=>{
  const {provider,methods,drafts}=draftBoundary();fixture.provider=provider;let release!:(value:unknown)=>void;
  methods.presentation.read.mockImplementationOnce(()=>new Promise(resolve=>{release=resolve;}));const first=render(<Form/>);
  fireEvent.change(screen.getByLabelText('Reference'),{target:{value:'Immediate navigation'}});first.unmount();await waitFor(()=>expect(release).toBeTypeOf('function'));
  await act(async()=>{release({});});await waitFor(()=>expect(drafts.size).toBe(1));const creation=[...drafts.values()][0].parts.creation;expect(creation&&'fields' in creation&&creation.fields.reference).toBe('Immediate navigation');
});
it('registers a submit middleware that flushes and consumes the current shared revision rather than stale submitted values',async()=>{
  const {provider,methods}=draftBoundary();fixture.provider=provider;fixture.record=(await provider.getOne('products',{id:'product'})).data;render(<Form/>);
  fireEvent.change(screen.getByLabelText('Reference'),{target:{value:'Current actual field'}});await waitFor(()=>expect(methods.roomDraft.write).toHaveBeenCalled());
  const next=vi.fn((resource,params)=>provider.update(resource,params));await act(async()=>{await fixture.middleware('products',{id:'product',previousData:fixture.record,data:{...fixture.record,reference:'Stale data'}},next);});
  expect(next.mock.calls[0][1].meta.houseDraft).toMatchObject({path:'shop/products/product.md'});expect((await provider.getOne('products',{id:'product'})).data.reference).toBe('Current actual field');expect(methods.save).toHaveBeenCalledOnce();
});
it('keeps partial or invalid numeric business input raw while converting completed valid numbers',()=>{
  for(const input of ['','-','1.','wrong','Infinity'])expect(parseBusinessNumber(input)).toBe(input);
  expect(parseBusinessNumber('1.25')).toBe(1.25);expect(parseBusinessNumber('-1')).toBe(-1);
});
