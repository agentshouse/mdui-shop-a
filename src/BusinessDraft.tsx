import {useCallback, useEffect, useRef, useState} from 'react';
import {Alert} from '@mui/material';
import {useDataProvider, useRecordContext, useResourceContext, useRegisterMutationMiddleware} from 'react-admin';
import {useFormContext} from 'react-hook-form';
import type {ShopDataProvider, ShopFormDraft} from './house';
const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);
/** Mount inside a donor Form. Actual values are durable; this component stores no content copy. */
export function BusinessDraft() {
  const provider = useDataProvider<ShopDataProvider>();
  const resource = useResourceContext();
  const record = useRecordContext();
  const identity = `${resource}/${record?._house?.path ?? 'create'}`;
  const {watch, getValues, setValue} = useFormContext();
  const opening = useRef<Promise<ShopFormDraft> | null>(null);
  const [error, setError] = useState('');
  const openedRecord = useRef(record);openedRecord.current = record;
  useEffect(() => {
    if (!resource) return;
    let active = true;let restoring = false;let session: ShopFormDraft | undefined;
    let baseline = structuredClone(getValues());
    const beforeOpen: Record<string, unknown> = {};
    const report = (failure: unknown) => {if (active) setError(failure instanceof Error ? failure.message : String(failure));};
    const apply = (values: Record<string, unknown>) => {
      if (!active) return;
      restoring = true;
      for (const [key,value] of Object.entries(values)) if (!same(getValues(key),value)) setValue(key,value,{shouldDirty:true,shouldValidate:false});
      baseline = structuredClone(getValues());restoring = false;
    };
    const pending = provider.openDraft(resource, openedRecord.current, baseline);
    opening.current = pending;
    const subscription = watch((values,{name}) => {
      if (restoring || !name) return;
      const field = name.split('.')[0];
      const value = values[field];
      if (same(baseline[field],value)) return;
      baseline[field] = structuredClone(value);beforeOpen[field] = value;
      if (session) void session.write({[field]:value}).catch(report);
    });
    void pending.then(async value => {
      session = value;
      if (active) value.subscribe(apply);
      apply({...value.values(), ...beforeOpen});
      if (Object.keys(beforeOpen).length) await value.write(beforeOpen);
      if (!active) value.close();
    }).catch(report);
    return () => {active = false;subscription.unsubscribe();session?.close();};
  },[identity, provider, resource, watch, getValues, setValue]);
  const middleware = useCallback(async (name: string, params: any, next: (resource: string, params: any) => Promise<any>) => {
    try {
      if (!opening.current) throw new Error('The local business draft is not ready.');
      const session = await opening.current;const prepared = await session.prepare();
      const meta = {...params.meta, ...(prepared.reference ? {houseDraft:prepared.reference} : {})};
      // A second tab may have saved this creation while this form stayed open.
      if (!openedRecord.current?._house && prepared.existing) return await provider.update(name,{id:prepared.data.id as string,data:prepared.data,previousData:prepared.previousData,meta});
      return await next(name,{...params,data:prepared.data,meta});
    } catch (failure) {setError(failure instanceof Error ? failure.message : String(failure));throw failure;}
  },[provider]);
  useRegisterMutationMiddleware(middleware);
  return error ? <Alert severity="error">{error}</Alert> : null;
}
