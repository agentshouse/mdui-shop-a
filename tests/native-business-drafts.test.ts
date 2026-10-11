// @vitest-environment node
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { definitions, readShop, type ShopResource } from '../src/house';
import { draftBoundary } from './support/business-drafts';

const records = JSON.parse(readFileSync(new URL('../scripts/donor-demo/records.json', import.meta.url), 'utf8')) as Record<ShopResource, Record<string, unknown>[]>;
const nativeDocuments = Object.entries(records).flatMap(([name, rows]) => {
  const resource = name as ShopResource;
  const type = definitions[resource].type;
  return rows.map(row => ({
    room: 'r', path: `shop/${resource}/${row.id}.md`, type,
    fields: { type, ...Object.fromEntries(Object.entries(row).map(([key, value]) => [key,
      typeof value === 'boolean' ? String(value) : value != null && typeof value === 'object' ? JSON.stringify(value) : value,
    ])) },
    markdown: JSON.stringify({ type, ...row }),
  }));
});
const edits = {
  categories: { name: 'Native category edit' },
  products: { reference: 'Native product edit' },
  customers: { first_name: 'Native customer edit' },
  orders: { reference: 'Native order edit' },
  invoices: { date: '2026-10-01T12:00:00Z' },
  reviews: { comment: 'Native review edit' },
} satisfies Record<ShopResource, Record<string, unknown>>;

it.each(Object.keys(definitions) as ShopResource[])('opens, edits, reopens and Saves a native fields-all %s row with exact original bases', async resource => {
  const { provider, documents, drafts, methods, statuses } = draftBoundary();
  documents.splice(0, documents.length, ...structuredClone(nativeDocuments));
  expect(documents).toHaveLength(2005);
  const originalDocuments = structuredClone(documents);
  const doc = documents.find(value => value.type === definitions[resource].type)!;
  const original = structuredClone(doc.fields);
  const { data } = await provider.getOne(resource, { id: String(doc.fields.id) });
  expect(data._house.fields).toEqual(original);
  const first = await provider.openDraft(resource, data, data);
  expect(first.values()).not.toHaveProperty('type');
  expect(first.values().id).toBe(original.id);
  expect(methods.roomDraft.write).not.toHaveBeenCalled();
  expect(methods.save).not.toHaveBeenCalled();
  await first.write({ ...edits[resource], type: 'not-an-editable-field' });
  first.close();
  const second = await provider.openDraft(resource, data, data);
  expect(second.values()).toMatchObject(edits[resource]);
  expect(second.values()).not.toHaveProperty('type');
  const prepared = await second.prepare();
  expect(prepared.previousData?._house.fields).toEqual(original);
  expect(prepared.previousData).not.toHaveProperty('type');
  const [key, value] = Object.entries(edits[resource])[0];
  expect(drafts.get(doc.path)?.parts).toEqual({ fields: { [key]: { value, base: { value: original[key] } } } });
  const writes = methods.roomDraft.write.mock.calls.length;
  await provider.update(resource, { id: data.id, previousData: prepared.previousData!, data: prepared.data, meta: { houseDraft: prepared.reference } });
  expect(methods.save).toHaveBeenCalledExactlyOnceWith('r', [prepared.reference]);
  expect(statuses.map(status => status.phase)).toEqual(['saving', 'queued']);
  expect(statuses.at(-1)).toEqual({ phase: 'queued', identifier: 'waiting-locally', message: 'Queued in House. Waiting for synchronization.' });
  expect(methods.roomDraft.write).toHaveBeenCalledTimes(writes);
  expect(methods.call).not.toHaveBeenCalled();
  expect(drafts.size).toBe(0);
  expect(doc.fields).toEqual({ ...original, ...edits[resource] });
  expect(doc.fields.type).toBe(definitions[resource].type);
  expect(documents.filter(value => value.path !== doc.path)).toEqual(originalDocuments.filter(value => value.path !== doc.path));
  const saved = (await provider.getOne(resource, { id: data.id })).data;
  const third = await provider.openDraft(resource, saved, saved);
  expect(third.values()).toMatchObject(edits[resource]);
  expect(third.values()).not.toHaveProperty('type');
  second.close(); third.close();
});

it.each(Object.keys(definitions) as ShopResource[])('refuses inconsistent native %s discriminators without discarding or writing data', async resource => {
  const { provider, documents, methods } = draftBoundary();
  documents.splice(0, documents.length, ...structuredClone(nativeDocuments));
  const doc = documents.find(value => value.type === definitions[resource].type)!;
  const { data } = await provider.getOne(resource, { id: String(doc.fields.id) });
  data._house.fields.type = 'shop_wrong_type';
  await expect(provider.openDraft(resource, data, data)).rejects.toThrow(`Mismatched ${resource} draft type`);
  doc.fields.type = 'shop_wrong_type';
  expect(() => readShop({ documents }, 'r')).toThrow(`Mismatched ${resource} document type`);
  expect(methods.roomDraft.write).not.toHaveBeenCalled();
  expect(methods.roomDraft.discard).not.toHaveBeenCalled();
  expect(methods.save).not.toHaveBeenCalled();
});

it('continues to reject unknown business draft fields', async () => {
  const { provider } = draftBoundary();
  const { data } = await provider.getOne('products', { id: 'product' });
  data._house.fields.unexpected = 'unsupported';
  await expect(provider.openDraft('products', data, data)).rejects.toThrow('Unsupported products draft field: unexpected');
});
