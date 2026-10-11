import { QueryClient, QueryObserver } from '@tanstack/react-query';
import { connectLocalQueryProjection } from '../src/local-query-projection';
// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { parse, validate, verify } from '@agentshouse/mdmodel';
// @ts-expect-error The seed is a standalone JavaScript CLI.
import { buildSeedChanges, seedRecords } from '../scripts/seed-data.mjs';
import { createHouseDataProvider, definitions, matchesFilter, observeShop, readShop, shopQuery,
  type HouseRuntime, type MutationStatus, type ShopResource } from '../src/house';
vi.mock('@agentshouse/app-bridge', () => ({ connectHouseBridge: vi.fn() }));

type Row = { id: string; [key: string]: any };
type Entry = [ShopResource, Row];
const ROOM = 'house://shop-test';
const DATE = '2026-10-01T10:00:00.000Z';
const customer = (id = 'customer-1', extra: Record<string, any> = {}): Row => ({
  id, first_name: 'Ada', last_name: 'Rivera', email: 'ada@example.test',
  first_seen: DATE, last_seen: DATE, has_newsletter: false, groups: [], ...extra,
});
const category = (id = 'category-1', extra: Record<string, any> = {}): Row => ({ id, name: 'Abstract', ...extra });
const product = (id = 'product-1', extra: Record<string, any> = {}): Row => ({
  id, category_id: 'category-1', reference: 'ABSTRACT-01', width: 30, height: 40,
  price: 25, stock: 8, sales: 0, thumbnail: '/posters/01.svg', image: '/posters/01.svg', ...extra,
});
const order = (id = 'order-1', extra: Record<string, any> = {}): Row => ({
  id, reference: 'ORD-001', date: DATE, customer_id: 'customer-1', status: 'ordered',
  basket: [{ product_id: 'product-1', quantity: 2 }], returned: false,
  total_ex_taxes: 50, delivery_fees: 5, tax_rate: 0.2, taxes: 10, total: 65, ...extra,
});
const invoice = (id = 'invoice-1', extra: Record<string, any> = {}): Row => ({
  id, date: DATE, order_id: 'order-1', customer_id: 'customer-1', total: 65, ...extra,
});
const review = (id = 'review-1', extra: Record<string, any> = {}): Row => ({
  id, date: DATE, status: 'pending', order_id: 'order-1', product_id: 'product-1',
  customer_id: 'customer-1', rating: 4, comment: 'Lovely print', ...extra,
});
const catalog = (): Entry[] => [['categories', category()], ['products', product()]];
const shop = (): Entry[] => [...catalog(), ['customers', customer()], ['orders', order()]];
function document(resource: ShopResource, row: Row) {
  const fields: Record<string, any> = Object.fromEntries(Object.entries(row).map(([key, value]) => [key,
    typeof value === 'boolean' ? String(value) : value != null && typeof value === 'object' ? JSON.stringify(value) : value]));
  return { room: ROOM, path: `shop/${resource}/${row.id}.md`, type: definitions[resource].type,
    fields, markdown: JSON.stringify({ resource, fields }) };
}
function fixture(rows: Entry[] = []) {
  const documents = rows.map(([resource, row]) => document(resource, row));
  const drafts = new Map<string, any>();
  const pending = new Map<string, any>();
  let mode: 'open' | 'write-halted' = 'open';
  const close = vi.fn();
  const md = {
    call: vi.fn(async (_name: string, _input: unknown): Promise<any> => ({ kind: 'undeclared' })),
    query: vi.fn(async (_query: unknown) => ({ documents: structuredClone(documents) })),
    observe: vi.fn(async (..._args: unknown[]) => ({ current: () => mode, subscribe: vi.fn(() => vi.fn()), close })),
    roomDraft: {
      read: vi.fn(async (_room: string, path: string): Promise<any> => drafts.get(path) ?? pending.get(path) ?? null),
      write: vi.fn(async (_room: string, path: string, revision: unknown, parts: any): Promise<any> => {
        expect(revision).toBeNull();
        const roomDraft = { room: ROOM, path, revision: `revision-${pending.size + 1}`, parts, changedUnderneath: {}, returned: null };
        pending.set(path, roomDraft);
        return { outcome: 'written', roomDraft };
      }),
      discard: vi.fn(),
    },
    save: vi.fn(async (_room: string, saved: { path: string; revision: string }[]): Promise<any> => {
      // Only the fixture applies queued changes. This does not imply remote synchronization.
      for (const { path } of saved) {
        const draft = pending.get(path);
        const index = documents.findIndex(doc => doc.path === path);
        if (draft.parts.removal) documents.splice(index, 1);
        else if (draft.parts.creation) documents.push({ room: ROOM, path, type: draft.parts.creation.type,
          fields: { ...draft.parts.creation.fields }, markdown: JSON.stringify(draft.parts.creation.fields) });
        else {
          const current = documents[index];
          for (const [key, patch] of Object.entries(draft.parts.fields ?? {}) as [string, any][]) current.fields[key] = patch.value;
          current.markdown = JSON.stringify(current.fields);
        }
        pending.delete(path);
      }
      return { outcome: 'saved', identifier: 'batch-1' };
    }),
  };
  const statuses: MutationStatus[] = [];
  const provider = createHouseDataProvider(md as unknown as HouseRuntime, ROOM, { onMutation: status => statuses.push(status) });
  return { md, provider, documents, drafts, pending, statuses, close, setMode: (value: typeof mode) => { mode = value; } };
}
const list = { pagination: { page: 1, perPage: 100 }, sort: { field: 'id', order: 'ASC' as const }, filter: {} };
const fieldsWritten = (f: ReturnType<typeof fixture>, index = 0) => f.md.roomDraft.write.mock.calls[index][3].fields;
function noWrites(f: ReturnType<typeof fixture>) {
  expect(f.md.roomDraft.write).not.toHaveBeenCalled();
  expect(f.md.save).not.toHaveBeenCalled();
  expect(f.md.roomDraft.discard).not.toHaveBeenCalled();
}

describe('House Shop reads', () => {
  it('requires a Room, scopes queries/observations, and never invents fallback data', async () => {
    const f = fixture();
    expect(() => createHouseDataProvider(f.md as unknown as HouseRuntime, '')).toThrow('Select');
    expect(await f.provider.getList('customers', list)).toEqual({ data: [], total: 0 });
    expect(f.md.query).toHaveBeenCalledWith({ ...shopQuery, rooms: [ROOM] });
    expect(shopQuery).toMatchObject({ types: Object.values(definitions).map(d => d.type), select: { fields: 'all', markdown: true } });
    await observeShop(f.md as unknown as HouseRuntime, ROOM);
    expect(f.md.observe).toHaveBeenCalledWith('query', { ...shopQuery, rooms: [ROOM] });
    f.md.query.mockRejectedValueOnce(new Error('Room unavailable'));
    await expect(f.provider.getList('customers', list)).rejects.toThrow('Room unavailable');
    await expect(f.provider.getOne('customers', { id: 'missing' })).rejects.toMatchObject({ status: 404 });
    expect(f.md.call).not.toHaveBeenCalled();
    noWrites(f);
  });
  it('decodes JSON/booleans and derives customer statistics from non-cancelled orders', async () => {
    const f = fixture([...shop(), ['orders', order('order-2', { date: '2026-10-02T00:00:00Z', total: 35, status: 'delivered' })],
      ['orders', order('order-3', { date: '2026-10-03T00:00:00Z', total: 999, status: 'cancelled' })],
      ['customers', customer('customer-2', { groups: ['collector'], has_newsletter: true })]]);
    expect((await f.provider.getOne('customers', { id: 'customer-1' })).data).toMatchObject({ has_newsletter: false,
      groups: [], has_ordered: true, nb_orders: 2, total_spent: 100, latest_purchase: '2026-10-02T00:00:00Z' });
    expect((await f.provider.getOne('customers', { id: 'customer-2' })).data).toMatchObject({ has_newsletter: true,
      groups: ['collector'], has_ordered: false, nb_orders: 0, total_spent: 0, latest_purchase: '' });
    expect((await f.provider.getOne('orders', { id: 'order-1' })).data).toMatchObject({ returned: false,
      basket: [{ product_id: 'product-1', quantity: 2 }] });
  });
  it('supports getMany/reference, filtering, totals before pagination and dotted numeric sorting', async () => {
    const f = fixture([...shop(), ['orders', order('order-2', { basket: [{ product_id: 'product-1', quantity: 12 }] })],
      ['customers', customer('customer-2')], ['orders', order('order-3', { customer_id: 'customer-2' })]]);
    const result = await f.provider.getManyReference('orders', { ...list, target: 'customer_id', id: 'customer-1',
      filter: { status: 'ordered' }, pagination: { page: 1, perPage: 1 }, sort: { field: 'basket.0.quantity', order: 'DESC' } });
    expect(result.total).toBe(2);
    expect(result.data.map(row => row.id)).toEqual(['order-2']);
    expect((await f.provider.getMany('orders', { ids: ['order-1', 'missing'] })).data.map(row => row.id)).toEqual(['order-1']);
    expect((await f.provider.getList('orders', { ...list, filter: { total_gte: 65, total_lte: 65, q: 'ord-001' } })).total).toBe(3);
  });
  it('keeps absent sort values last in either direction', async () => {
    const f = fixture([['customers', customer('customer-1', { city: '' })], ['customers', customer('customer-2', { city: 'Paris' })],
      ['customers', customer('customer-3', { city: 'Amsterdam' })]]);
    for (const direction of ['ASC', 'DESC'] as const) {
      const result = await f.provider.getList('customers', { ...list, sort: { field: 'city', order: direction } });
      expect(result.data.at(-1)?.id).toBe('customer-1');
      expect(result.data[0].city).toBe(direction === 'ASC' ? 'Amsterdam' : 'Paris');
    }
  });
  it.each([{ page: 0, perPage: 10 }, { page: 1, perPage: 0 }, { page: 1.2, perPage: 10 }, { page: 1, perPage: Infinity }])( 'rejects invalid pagination %j', async pagination => {
      await expect(fixture().provider.getList('customers', { ...list, pagination })).rejects.toThrow('pagination');
    });
  it('rejects unsupported resources/types, out-of-Room records, duplicates and invalid IDs', async () => {
    await expect(fixture().provider.getList('users', list)).rejects.toThrow('Unsupported');
    expect(() => readShop({ documents: [{ ...document('customers', customer()), type: 'crm_contact' }] }, ROOM)).toThrow('Unsupported');
    expect(() => readShop({ documents: [{ ...document('customers', customer()), room: 'other' }] }, ROOM)).toThrow('outside');
    expect(() => readShop({ documents: [document('customers', customer()), { ...document('customers', customer()), path: 'duplicate.md' }] }, ROOM)).toThrow('Duplicate');
    expect(() => readShop({ documents: [document('customers', customer('bad/path'))] }, ROOM)).toThrow('IDs');
    expect(() => readShop({ documents: [document('customers', customer('customer-1', { email: '' }))] }, ROOM)).toThrow('email is required');
  });
  it.each([
    ['has_newsletter', true, 'true or false'], ['has_newsletter', 'TRUE', 'true or false'],
    ['groups', [], 'JSON string'], ['groups', '[bad', 'invalid JSON'], ['groups', '{}', 'array'],
    ['groups', 'null', 'Cannot clear'], ['first_name', null, 'typed null'], ['first_name', 99, 'string'],
  ])('rejects malformed stored %s = %j', (field, value, message) => {
    const doc = document('customers', customer()); doc.fields[field as string] = value;
    expect(() => readShop({ documents: [doc] }, ROOM)).toThrow(message as string);
  });
});

describe('Shop donor filters', () => {
  const row = { id: 'customer-1', first_name: 'Ada', groups: ['collector', 'vip'], total_spent: 50,
    last_seen: DATE, city: '', basket: [{ product_id: 'product-1', quantity: 2 }], _house: { secret: 'unsearchable-marker' } };
  it.each([{ total_spent_gte: 50 }, { total_spent_lte: 50 }, { total_spent_gt: 49 }, { total_spent_lt: 51 },
    { total_spent_neq: 60 }, { groups: 'vip' }, { groups: ['vip', 'collector'] }, { groups: [] }, { q: 'ADA' },
    { q: 'product-1' }, { city: null }, { 'basket.0.quantity_gte': 2 }, { last_seen_gte: '2026-10-01' },
    { ignored: '' }, { ignored: undefined }])('matches %j', filter => { expect(matchesFilter(row, filter)).toBe(true); });
  it.each([{ groups: 'missing' }, { groups: ['vip', 'missing'] }, { q: 'unsearchable-marker' },
    { total_spent_gt: 50 }, { total_spent_lt: 50 }, { missing_gte: 0 }, { total_spent_neq: 50 }])( 'does not match %j', filter => { expect(matchesFilter(row, filter)).toBe(false); });
});

describe('Creation and validation', () => {
  it('creates customer defaults with generated IDs and encoded JSON/boolean fields', async () => {
    const f = fixture();
    const { data } = await f.provider.create('customers', { data: { first_name: 'Nora', last_name: 'Chen', email: 'nora@example.test' } });
    expect(data.id).toMatch(/^customers-[a-f0-9-]+$/);
    expect(data).toMatchObject({ has_newsletter: false, has_ordered: false, groups: [], nb_orders: 0, total_spent: 0 });
    expect(Number.isFinite(Date.parse(data.first_seen))).toBe(true); expect(data.first_seen).toBe(data.last_seen);
    expect(f.md.roomDraft.write).toHaveBeenCalledWith(ROOM, `shop/customers/${data.id}.md`, null,
      { creation: { type: 'shop_customer', fields: expect.objectContaining({ id: data.id,
        groups: '[]', has_newsletter: 'false', has_ordered: 'false' }), sections: {} } });
    expect(f.md.save).toHaveBeenCalledWith(ROOM, [{ path: `shop/customers/${data.id}.md`, revision: 'revision-1' }]);
    expect(f.statuses.map(s => s.phase)).toEqual(['saving', 'queued']);
    expect(f.statuses.at(-1)).toEqual({ phase: 'queued', identifier: 'batch-1', message: 'Queued in House. Waiting for synchronization.' });
    expect(f.close).toHaveBeenCalledOnce();
  });
  it('supplies product artwork/stock and review date/status defaults', async () => {
    const f = fixture(shop());
    expect((await f.provider.create('products', { data: { id: 'product-2', category_id: 'category-1', reference: 'NEW-01',
      width: 20, height: 30, price: 40 } })).data).toMatchObject({ image: '/posters/01.svg', thumbnail: '/posters/01.svg',
      description: '', sales: 0, stock: 0 });
    const r = (await f.provider.create('reviews', { data: { id: 'review-1', customer_id: 'customer-1', product_id: 'product-1',
      rating: 5, comment: 'Great' } })).data;
    expect(r.status).toBe('pending'); expect(Number.isFinite(Date.parse(r.date))).toBe(true);
  });
  it.each(['password', 'password_confirmation', 'api_key', 'secret', 'token', 'role'])( 'rejects account/secret field %s', async field => {
      const f = fixture();
      await expect(f.provider.create('customers', { data: { ...customer(), [field]: 'not-a-real-secret' } })).rejects.toThrow('Unsupported');
      noWrites(f);
    });
  it.each(['https://example.test/poster.png', '//example.test/poster.png', 'data:image/svg+xml,test', 'blob:temporary',
    '/posters/13.svg', '/posters/../secret.svg'])('rejects unbundled artwork %s', async image => {
    const f = fixture(catalog());
    await expect(f.provider.create('products', { data: product('product-2', { image }) })).rejects.toThrow('bundled');
    noWrites(f);
  });
  it.each([
    ['customers', customer('customer-2', { birthday: 'not-a-date' }), 'valid date'],
    ['customers', customer('customer-2', { groups: [1] }), 'segments'],
    ['customers', customer('customer-2', { has_newsletter: 'true' }), 'boolean'],
    ['products', product('product-2', { price: -1 }), 'non-negative'],
    ['products', product('product-2', { price: NaN }), 'finite'],
    ['products', product('product-2', { stock: 1.5 }), 'integer'],
    ['products', product('product-2', { sales: 1.5 }), 'integer'],
    ['orders', order('order-2', { status: 'shipped' }), 'status'],
    ['orders', order('order-2', { basket: [] }), 'at least one'],
    ['orders', order('order-2', { basket: [{ product_id: 'product-1', quantity: 0 }] }), 'positive integer'],
    ['orders', order('order-2', { basket: [{ product_id: 'product-1', quantity: 1.5 }] }), 'positive integer'],
    ['orders', order('order-2', { basket: [{ product_id: 'product-1', quantity: 1, price: 20 }] }), 'Basket items'],
    ['reviews', review('review-1', { rating: 6 }), 'between 1 and 5'],
    ['reviews', review('review-1', { rating: 1.5 }), 'between 1 and 5'],
    ['reviews', review('review-1', { status: 'published' }), 'status'],
  ] as [ShopResource, Row, string][])('rejects invalid %s data %j', async (resource, data, message) => {
    const f = fixture(shop()); await expect(f.provider.create(resource, { data })).rejects.toThrow(message); noWrites(f);
  });
  it('preserves unavailable donor artwork when changing ordinary product fields', async () => {
    const f = fixture([['categories', category()], ['products', product('product-1', { image: '', thumbnail: '' })]]);
    const before = (await f.provider.getOne('products', { id: 'product-1' })).data;
    const { data } = await f.provider.update('products', { id: before.id, previousData: before,
      data: { price: 38, stock: 9, image: '', thumbnail: '' } });
    expect(data).toMatchObject({ price: 38, stock: 9, image: '', thumbnail: '' });
    expect(Object.keys(fieldsWritten(f)).sort()).toEqual(['price', 'stock']);
    const created = await f.provider.create('products', { data: product('product-2', { image: '', thumbnail: '' }) });
    expect(created.data).toMatchObject({ image: '', thumbnail: '' });
  });
  it('also rejects account fields and remote artwork in edits', async () => {
    const f = fixture([...catalog(), ['customers', customer()]]);
    const c = (await f.provider.getOne('customers', { id: 'customer-1' })).data;
    await expect(f.provider.update('customers', { id: c.id, previousData: c, data: { password: 'not-a-real-secret' } })).rejects.toThrow('Unsupported');
    const p = (await f.provider.getOne('products', { id: 'product-1' })).data;
    await expect(f.provider.update('products', { id: p.id, previousData: p, data: { thumbnail: 'https://example.test/p.png' } })).rejects.toThrow('bundled');
    noWrites(f);
  });
  it.each(['total_ex_taxes', 'delivery_fees', 'tax_rate', 'taxes'])('requires order monetary field %s', async field => {
    const f = fixture(shop()); const data = order('order-2'); delete data[field];
    await expect(f.provider.create('orders', { data })).rejects.toThrow(`${field} is required`); noWrites(f);
  });
  it.each([-0.01, 1.01, 10])('rejects tax rates outside the fractional range: %s', async tax_rate => {
    const f = fixture(shop());
    await expect(f.provider.create('orders', { data: order('order-2', { tax_rate }) })).rejects.toThrow(/tax.?rate|non-negative/i);
    await expect(f.provider.create('invoices', { data: invoice('invoice-1', { tax_rate }) })).rejects.toThrow(/tax.?rate|non-negative/i);
    noWrites(f);
  });
  it.each([0, 1])('accepts the tax-rate boundary %s', async tax_rate => {
    const f = fixture(shop());
    expect((await f.provider.create('orders', { data: order('order-2', { tax_rate }) })).data.tax_rate).toBe(tax_rate);
  });
  it('rejects duplicate IDs, path IDs and unsupported resource writes', async () => {
    const f = fixture([['customers', customer()]]);
    await expect(f.provider.create('customers', { data: customer() })).rejects.toThrow('already exists');
    await expect(f.provider.create('customers', { data: customer('../escape') })).rejects.toThrow('IDs');
    await expect(f.provider.create('users', { data: { id: '1' } })).rejects.toThrow('Unsupported');
    noWrites(f);
  });
});

describe('Reference integrity', () => {
  it.each([
    ['products', product('product-2', { category_id: 'missing' })], ['orders', order('order-2', { customer_id: 'missing' })],
    ['orders', order('order-2', { basket: [{ product_id: 'missing', quantity: 1 }] })],
    ['invoices', invoice('invoice-1', { order_id: 'missing' })], ['reviews', review('review-1', { product_id: 'missing' })],
  ] as Entry[])('rejects missing references in %s', async (resource, data) => {
    const f = fixture(shop()); await expect(f.provider.create(resource, { data })).rejects.toThrow('missing'); noWrites(f);
  });
  it('rejects dangling references on read', () => {
    expect(() => readShop({ documents: [document('products', product())] }, ROOM)).toThrow('missing categories');
  });
  it.each(['invoices', 'reviews'] as const)('rejects cross-customer %s', async resource => {
    const f = fixture([...shop(), ['customers', customer('customer-2')]]);
    const data = resource === 'invoices' ? invoice('invoice-1', { customer_id: 'customer-2' }) : review('review-1', { customer_id: 'customer-2' });
    await expect(f.provider.create(resource, { data })).rejects.toThrow('different customer'); noWrites(f);
  });
  it('requires reviewed product to belong to the selected order basket', async () => {
    const f = fixture([...shop(), ['products', product('product-2')]]);
    await expect(f.provider.create('reviews', { data: review('review-1', { product_id: 'product-2' }) })).rejects.toThrow('not in the selected order');
    noWrites(f);
  });
  it('validates the effective field delta against current references for stale full-form submissions', async () => {
    const f = fixture([...shop(), ['customers', customer('customer-2')], ['products', product('product-2')],
      ['orders', order('order-2')], ['reviews', review()]]);
    const before = (await f.provider.getOne('reviews', { id: 'review-1' })).data;
    // Another tab consistently moves order-1 and its review to a different customer/product.
    const currentOrder = f.documents.find(doc => doc.fields.id === 'order-1')!;
    currentOrder.fields.customer_id = 'customer-2';
    currentOrder.fields.basket = JSON.stringify([{ product_id: 'product-2', quantity: 1 }]);
    const currentReview = f.documents.find(doc => doc.fields.id === 'review-1')!;
    currentReview.fields.customer_id = 'customer-2'; currentReview.fields.product_id = 'product-2';
    // Unchanged old form fields are not written. Only order_id changes, so customer-2 would remain.
    await expect(f.provider.update('reviews', { id: before.id, previousData: before,
      data: { ...before, order_id: 'order-2' } })).rejects.toThrow('different customer');
    noWrites(f);
  });
  it('applies the same effective-delta reference checks to bulk edits', async () => {
    const f = fixture([...shop(), ['customers', customer('customer-2')], ['products', product('product-2')],
      ['orders', order('order-2')], ['reviews', review()]]);
    await f.provider.getList('reviews', list);
    const currentOrder = f.documents.find(doc => doc.fields.id === 'order-1')!;
    currentOrder.fields.customer_id = 'customer-2';
    currentOrder.fields.basket = JSON.stringify([{ product_id: 'product-2', quantity: 1 }]);
    const currentReview = f.documents.find(doc => doc.fields.id === 'review-1')!;
    currentReview.fields.customer_id = 'customer-2'; currentReview.fields.product_id = 'product-2';
    await expect(f.provider.updateMany('reviews', { ids: ['review-1'],
      data: { order_id: 'order-2', customer_id: 'customer-1', product_id: 'product-1' } })).rejects.toThrow('different customer');
    noWrites(f);
  });
  it('validates reverse references when editing orders and bulk editing products', async () => {
    const f = fixture([...shop(), ['customers', customer('customer-2')], ['invoices', invoice()], ['reviews', review()]]);
    const before = (await f.provider.getOne('orders', { id: 'order-1' })).data;
    await expect(f.provider.update('orders', { id: before.id, previousData: before, data: { customer_id: 'customer-2' } })).rejects.toThrow('different customer');
    await f.provider.getList('products', list);
    await expect(f.provider.updateMany('products', { ids: ['product-1'], data: { category_id: 'missing' } })).rejects.toThrow('missing');
    noWrites(f);
  });
});

describe('Exact opened snapshots and field bases', () => {
  it('uses original field bases after concurrent edits, including absent and empty values', async () => {
    const f = fixture([['customers', customer('customer-1', { address: '' })]]);
    const before = (await f.provider.getOne('customers', { id: 'customer-1' })).data;
    f.documents[0].fields.first_name = 'Changed elsewhere';
    await f.provider.update('customers', { id: before.id, previousData: before, data: { first_name: 'Edited', address: '1 Maple Street', city: 'Paris' } });
    expect(fieldsWritten(f)).toEqual({ first_name: { value: 'Edited', base: { value: 'Ada' } },
      address: { value: '1 Maple Street', base: { value: '' } }, city: { value: 'Paris', base: null } });
  });
  it('returns current untouched fields after stale full-form updates', async () => {
    const f = fixture([['customers', customer()]]);
    const before = (await f.provider.getOne('customers', { id: 'customer-1' })).data;
    f.documents[0].fields.first_name = 'Grace';
    const result = await f.provider.update('customers', { id: before.id, previousData: before,
      data: { ...before, last_name: 'Chen' } });
    expect(fieldsWritten(f)).not.toHaveProperty('first_name');
    expect(f.documents[0].fields.first_name).toBe('Grace');
    expect(result.data.first_name).toBe('Grace');
  });
  it('preserves concurrent array edits when stale full-form JSON differs only in storage spacing', async () => {
    const f = fixture([['customers', customer('customer-1', {
      has_ordered: false, nb_orders: 0, total_spent: 0, latest_purchase: '',
    })]]);
    f.documents[0].fields.groups = '[ "collector" ]';
    const before = (await f.provider.getOne('customers', { id: 'customer-1' })).data;
    expect(before.groups).toEqual(['collector']);
    f.documents[0].fields.groups = '["regular"]';
    const result = await f.provider.update('customers', { id: before.id, previousData: before,
      data: { ...before, first_name: 'Nora', groups: ['collector'] } });
    expect(fieldsWritten(f)).toEqual({ first_name: { value: 'Nora', base: { value: 'Ada' } } });
    expect(result.data.groups).toEqual(['regular']);
    expect(f.documents[0].fields.groups).toBe('["regular"]');
    expect((await f.provider.getOne('customers', { id: before.id })).data.groups).toEqual(['regular']);
  });
  it('preserves exact JSON spelling and boolean string bases', async () => {
    const f = fixture([['customers', customer()]]); f.documents[0].fields.groups = '[ "vip", "collector" ]';
    const before = (await f.provider.getOne('customers', { id: 'customer-1' })).data;
    f.documents[0].fields.groups = '["regular"]';
    await f.provider.update('customers', { id: before.id, previousData: before, data: { groups: ['collector'], has_newsletter: true } });
    expect(fieldsWritten(f)).toEqual({ groups: { value: '["collector"]', base: { value: '[ "vip", "collector" ]' } },
      has_newsletter: { value: 'true', base: { value: 'false' } } });
  });
  it('clones last-opened snapshots for updates without previousData', async () => {
    const f = fixture([['customers', customer()]]);
    const before = (await f.provider.getOne('customers', { id: 'customer-1' })).data;
    before.first_name = 'Mutated form'; before._house.fields.first_name = 'Mutated form';
    await f.provider.update('customers', { id: 'customer-1', data: { first_name: 'Nora' } } as any);
    expect(fieldsWritten(f).first_name.base).toEqual({ value: 'Ada' });
  });
  it('reports no-op edits as idle without a draft', async () => {
    const f = fixture([['customers', customer()]]); const before = (await f.provider.getOne('customers', { id: 'customer-1' })).data;
    await f.provider.update('customers', { id: before.id, previousData: before, data: { first_name: 'Ada', city: undefined } });
    noWrites(f); expect(f.statuses.map(s => s.phase)).toEqual(['saving', 'idle']);
  });
  it('clears optional text as empty string and rejects null numeric fields', async () => {
    const f = fixture(catalog()); const before = (await f.provider.getOne('products', { id: 'product-1' })).data;
    await f.provider.update('products', { id: before.id, previousData: before, data: { description: null } });
    expect(fieldsWritten(f).description).toEqual({ value: '', base: null });
    await expect(f.provider.update('products', { id: before.id, previousData: before, data: { price: null } })).rejects.toThrow('Cannot clear price');
    expect(f.md.save).toHaveBeenCalledOnce();
  });
  it('refuses writes without opened snapshots', async () => {
    const f = fixture([['customers', customer()]]);
    await expect(f.provider.update('customers', { id: 'customer-1', data: { first_name: 'New' } } as any)).rejects.toThrow('Open this record');
    await expect(f.provider.update('customers', { id: 'customer-1', data: { first_name: 'New' }, previousData: customer() })).rejects.toThrow('snapshot');
    noWrites(f);
  });
  it.each(['room', 'type', 'id'])('rejects a snapshot with wrong %s', async part => {
    const f = fixture([['customers', customer()]]); const before = (await f.provider.getOne('customers', { id: 'customer-1' })).data;
    if (part === 'id') before._house.fields.id = 'customer-2'; else before._house[part] = 'wrong';
    await expect(f.provider.update('customers', { id: 'customer-1', previousData: before, data: { first_name: 'New' } })).rejects.toThrow('snapshot');
    noWrites(f);
  });
  it('rejects mismatched IDs, ID changes and moved/deleted documents', async () => {
    const f = fixture([['customers', customer()]]); const before = (await f.provider.getOne('customers', { id: 'customer-1' })).data;
    await expect(f.provider.update('customers', { id: 'customer-2', previousData: before, data: {} })).rejects.toThrow('another record');
    await expect(f.provider.update('customers', { id: before.id, previousData: before, data: { id: 'customer-2' } })).rejects.toThrow('cannot change');
    f.documents[0].path = 'shop/customers/moved.md';
    await expect(f.provider.update('customers', { id: before.id, previousData: before, data: { first_name: 'New' } })).rejects.toThrow('moved or was deleted');
    f.documents.length = 0;
    await expect(f.provider.update('customers', { id: before.id, previousData: before, data: { first_name: 'New' } })).rejects.toThrow('moved or was deleted'); noWrites(f);
  });
});

describe('Grouped drafts, races and synchronization', () => {
  it('stops on query failure and closes its service observation', async () => {
    const f = fixture(); f.md.query.mockRejectedValueOnce(new Error('Room disconnected'));
    await expect(f.provider.create('categories', { data: category() })).rejects.toThrow('Room disconnected');
    noWrites(f); expect(f.statuses.map(s => s.phase)).toEqual(['saving', 'error']);
    expect(f.close).toHaveBeenCalledOnce();
  });
  it('keeps prepared drafts after transport failures rather than claiming a queued save', async () => {
    const f = fixture(); f.md.save.mockRejectedValueOnce(new Error('Transport disconnected'));
    await expect(f.provider.create('categories', { data: category() })).rejects.toThrow('Transport disconnected');
    expect(f.pending.size).toBe(1); expect(f.md.roomDraft.discard).not.toHaveBeenCalled();
    expect(f.statuses.map(s => s.phase)).toEqual(['saving', 'error']);
  });
  it('allows empty bulk selections without generating an empty save', async () => {
    const f = fixture(); await f.provider.updateMany('customers', { ids: [], data: { first_name: 'Nora' } });
    await f.provider.deleteMany('customers', { ids: [] }); noWrites(f);
    expect(f.statuses.map(s => s.phase)).toEqual(['saving', 'idle', 'saving', 'idle']);
  });
  it('preflights every selected path before preparing any grouped draft', async () => {
    const f = fixture([['customers', customer()], ['customers', customer('customer-2')]]); await f.provider.getList('customers', list);
    f.drafts.set('shop/customers/customer-2.md', { revision: 'existing', returned: { kind: 'conflicted' } });
    await expect(f.provider.updateMany('customers', { ids: ['customer-1', 'customer-2'], data: { has_newsletter: true } })).rejects.toThrow('unfinished');
    expect(f.md.roomDraft.read).toHaveBeenCalledTimes(2); noWrites(f);
  });
  it('groups bulk edits with each original base in one save', async () => {
    const f = fixture([['customers', customer()], ['customers', customer('customer-2')]]); await f.provider.getList('customers', list);
    await f.provider.updateMany('customers', { ids: ['customer-1', 'customer-2'], data: { groups: ['vip'] } });
    expect(f.md.save).toHaveBeenCalledOnce(); expect(f.md.save.mock.calls[0][1]).toHaveLength(2);
    expect(fieldsWritten(f)).toEqual({ groups: { value: '["vip"]', base: { value: '[]' } } });
    expect(fieldsWritten(f, 1)).toEqual({ groups: { value: '["vip"]', base: { value: '[]' } } });
  });
  it('refuses repeated paths and bulk ID changes before draft preparation', async () => {
    const f = fixture([['customers', customer()], ['customers', customer('customer-2')]]); await f.provider.getList('customers', list);
    await expect(f.provider.updateMany('customers', { ids: ['customer-1', 'customer-1'], data: { first_name: 'Nora' } })).rejects.toThrow('same document twice');
    await expect(f.provider.updateMany('customers', { ids: ['customer-1', 'customer-2'], data: { id: 'customer-1' } })).rejects.toThrow('cannot change'); noWrites(f);
  });
  it('keeps prepared drafts when a later grouped write races another tab', async () => {
    const f = fixture([['customers', customer()], ['customers', customer('customer-2')]]); await f.provider.getList('customers', list);
    f.md.roomDraft.write.mockImplementationOnce(f.md.roomDraft.write.getMockImplementation()!).mockResolvedValueOnce({ outcome: 'stale', current: null });
    await expect(f.provider.updateMany('customers', { ids: ['customer-1', 'customer-2'], data: { first_name: 'Nora' } })).rejects.toThrow('another tab');
    expect(f.pending.size).toBe(1); expect(f.md.save).not.toHaveBeenCalled(); expect(f.md.roomDraft.discard).not.toHaveBeenCalled();
    expect(f.statuses.at(-1)?.phase).toBe('error');
  });
  it.each(['write-halted', 'conflicted', 'invalid-document'])('keeps drafts when save refuses %s', async rule => {
    const f = fixture(); f.md.save.mockResolvedValueOnce({ outcome: 'refused', rule });
    await expect(f.provider.create('categories', { data: category() })).rejects.toThrow(`House did not queue this change: ${rule}`);
    expect(f.pending.size).toBe(1); expect(f.md.roomDraft.discard).not.toHaveBeenCalled();
    expect(f.statuses.at(-1)?.phase).toBe('error'); expect(f.close).toHaveBeenCalledOnce();
  });
  it('reports queued, never synced, even when the synchronized view has not changed', async () => {
    const f = fixture(); f.md.save.mockResolvedValueOnce({ outcome: 'saved', identifier: 'still-offline' });
    await f.provider.create('categories', { data: category() });
    expect(await f.provider.getList('categories', list)).toEqual({ data: [], total: 0 });
    expect(f.statuses.at(-1)).toMatchObject({ phase: 'queued', identifier: 'still-offline' });
    expect(f.statuses.some(s => /synced|synchronized successfully/i.test(s.message))).toBe(false);
  });
  it('queues local Save while provider uploads are halted', async () => {
    const f = fixture(); f.setMode('write-halted');
    await expect(f.provider.create('categories', { data: category() })).resolves.toMatchObject({ data: category() });
    expect(f.md.roomDraft.write).toHaveBeenCalledOnce(); expect(f.md.save).toHaveBeenCalledOnce(); expect(f.close).toHaveBeenCalledOnce();
  });
  it('does not confuse a provider halt during local reading with a local Save failure', async () => {
    const f = fixture(); f.md.query.mockImplementationOnce(async () => { f.setMode('write-halted'); return { documents: [] }; });
    await expect(f.provider.create('categories', { data: category() })).resolves.toMatchObject({ data: category() }); expect(f.md.save).toHaveBeenCalledOnce();
  });
  it('serializes concurrent saves and recovers after rejected mutations', async () => {
    const f = fixture(); let release!: () => void; let started!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; }); const saving = new Promise<void>(resolve => { started = resolve; });
    const normalSave = f.md.save.getMockImplementation()!;
    f.md.save.mockImplementationOnce(async (...args) => { started(); await gate; return normalSave(...args); });
    const first = f.provider.create('categories', { data: category('category-1') });
    const second = f.provider.create('categories', { data: category('category-2') });
    await saving; expect(f.md.query).toHaveBeenCalledOnce(); expect(f.md.save).toHaveBeenCalledOnce(); release();
    await Promise.all([first, second]); expect(f.statuses.map(s => s.phase)).toEqual(['saving', 'queued', 'saving', 'queued']);
    await expect(f.provider.create('categories', { data: category('category-1') })).rejects.toThrow('already exists');
    await f.provider.create('categories', { data: category('category-3') }); expect(f.documents).toHaveLength(3);
  });
  it('preserves independent concurrent edits with exact original bases', async () => {
    const f = fixture([['customers', customer()]]); const before = (await f.provider.getOne('customers', { id: 'customer-1' })).data;
    await Promise.all([f.provider.update('customers', { id: before.id, previousData: before, data: { first_name: 'Nora' } }),
      f.provider.update('customers', { id: before.id, previousData: before, data: { last_name: 'Chen' } })]);
    expect(fieldsWritten(f)).toEqual({ first_name: { value: 'Nora', base: { value: 'Ada' } } });
    expect(fieldsWritten(f, 1)).toEqual({ last_name: { value: 'Chen', base: { value: 'Rivera' } } });
    expect((await f.provider.getOne('customers', { id: before.id })).data).toMatchObject({ first_name: 'Nora', last_name: 'Chen' });
  });
});

describe('Deletion safeguards', () => {
  it.each([['categories', 'category-1'], ['products', 'product-1'], ['customers', 'customer-1'], ['orders', 'order-1']] as [ShopResource, string][])( 'blocks deleting referenced %s', async (resource, id) => {
      const f = fixture([...shop(), ['invoices', invoice()], ['reviews', review()]]); const before = (await f.provider.getOne(resource, { id })).data;
      await expect(f.provider.delete(resource, { id, previousData: before })).rejects.toThrow('still referenced'); noWrites(f);
    });
  it.each(['markdown', 'fields', 'missing markdown'])('blocks deleting with changed or unavailable %s', async kind => {
    const f = fixture([['categories', category()]]); if (kind === 'missing markdown') delete (f.documents[0] as any).markdown;
    const before = (await f.provider.getOne('categories', { id: 'category-1' })).data;
    if (kind === 'markdown') f.documents[0].markdown += '\nNew section'; if (kind === 'fields') f.documents[0].fields.name = 'Edited elsewhere';
    await expect(f.provider.delete('categories', { id: before.id, previousData: before })).rejects.toThrow('changed since'); noWrites(f);
  });
  it('requires opened snapshots for bulk deletes and rejects duplicate selections', async () => {
    const f = fixture([['categories', category()]]);
    await expect(f.provider.deleteMany('categories', { ids: ['category-1'] })).rejects.toThrow('Open this record');
    await f.provider.getList('categories', list);
    await expect(f.provider.deleteMany('categories', { ids: ['category-1', 'category-1'] })).rejects.toThrow('same document twice');
    noWrites(f);
  });
  it('uses exact whole Markdown for single deletion', async () => {
    const f = fixture([['categories', category()]]); const before = (await f.provider.getOne('categories', { id: 'category-1' })).data;
    const markdown = f.documents[0].markdown; await f.provider.delete('categories', { id: before.id, previousData: before });
    expect(f.md.roomDraft.write).toHaveBeenCalledWith(ROOM, 'shop/categories/category-1.md', null, { removal: { base: markdown } });
    expect(f.documents).toHaveLength(0);
  });
  it('groups deletion with every exact base in one save', async () => {
    const f = fixture([['categories', category()], ['categories', category('category-2')]]); await f.provider.getList('categories', list);
    const originals = f.documents.map(doc => doc.markdown); await f.provider.deleteMany('categories', { ids: ['category-1', 'category-2'] });
    expect(f.md.save).toHaveBeenCalledOnce(); expect(f.md.save.mock.calls[0][1]).toHaveLength(2);
    expect(f.md.roomDraft.write.mock.calls.map(call => call[3].removal.base)).toEqual(originals); expect(f.documents).toHaveLength(0);
  });
  it('refuses a whole grouped deletion if one selected item is referenced or stale', async () => {
    const f = fixture([...catalog(), ['categories', category('category-2')]]); await f.provider.getList('categories', list);
    await expect(f.provider.deleteMany('categories', { ids: ['category-1', 'category-2'] })).rejects.toThrow('still referenced'); noWrites(f);
    const g = fixture([['categories', category()], ['categories', category('category-2')]]); await g.provider.getList('categories', list);
    g.documents[1].markdown += '\nChanged';
    await expect(g.provider.deleteMany('categories', { ids: ['category-1', 'category-2'] })).rejects.toThrow('changed since'); noWrites(g);
  });
});

describe('Published Shop model and synthetic seed', () => {
  it('declares exactly the retained resources in the manifest and verified schema', () => {
    const schema = readFileSync(new URL('../schema.yaml', import.meta.url), 'utf8');
    const manifest = JSON.parse(readFileSync(new URL('../app.json', import.meta.url), 'utf8'));
    expect(manifest.room_slots[0]).toMatchObject({ name: 'shop', access: 'write' });
    expect([...manifest.room_slots[0].types].sort()).toEqual(Object.values(definitions).map(d => d.type).sort());
    for (const { type } of Object.values(definitions)) expect(schema).toContain(`${type}:`);
    expect(verify(schema).verdict).toBe('accept');
  });
  it('validates all 72 seed records and loads all six resources', () => {
    const { changes } = buildSeedChanges('shop-test') as { changes: { path: string; content: string }[] };
    expect(changes).toHaveLength(73);
    const schema = verify(changes[0].content); expect(schema.verdict).toBe('accept');
    if (schema.verdict !== 'accept') throw new Error('Schema refused');
    const library = Object.fromEntries(changes.slice(1).map(change => [change.path.replace('/rooms/shop-test/', ''), change.content]));
    expect(validate(library, { binaryTargets: [] }, schema.model)).toEqual({ verdict: 'accept' });
    const documents = Object.entries(library).map(([path, markdown]) => {
      const parsed = parse(markdown, path); if (!parsed.ok) throw new Error(`Seed Markdown did not parse: ${path}`);
      return { room: ROOM, path, type: parsed.document.type, fields: parsed.document.fields, markdown };
    });
    const db = readShop({ documents }, ROOM);
    for (const resource of Object.keys(definitions) as ShopResource[]) {
      expect(db[resource].length).toBeGreaterThan(0); expect(db[resource]).toHaveLength(seedRecords[resource].length);
    }
    for (const row of [...db.orders, ...db.invoices]) {
      expect(row.tax_rate).toBeGreaterThanOrEqual(0); expect(row.tax_rate).toBeLessThanOrEqual(1);
      expect(row.taxes).toBe(Math.round((row.total_ex_taxes + row.delivery_fees) * row.tax_rate * 100) / 100);
      expect(row.total).toBe(Math.round((row.total_ex_taxes + row.delivery_fees + row.taxes) * 100) / 100);
    }
    expect(documents).toHaveLength(72);
  });
});


it('refuses stale provider reads and preserves drafts when readiness is lost during save preparation', async () => {
 const f=fixture([['categories',category()]]);let available=false;
 const provider=createHouseDataProvider(f.md as unknown as HouseRuntime,ROOM,{isAvailable:()=>available});
 await expect(provider.getList('categories',{pagination:{page:1,perPage:10},sort:{field:'id',order:'ASC' as const},filter:{}})).rejects.toThrow(/binding is not ready/);
 expect(f.md.query).not.toHaveBeenCalled();
 available=true;const before=(await provider.getOne('categories',{id:'category-1'})).data;
 f.md.roomDraft.read.mockImplementationOnce(async()=>{available=false;return null;});
 await expect(provider.update('categories',{id:before.id,data:{name:'Unsaved edit'},previousData:before})).rejects.toThrow(/binding is not ready/);
 expect(f.md.roomDraft.write).not.toHaveBeenCalled();expect(f.md.save).not.toHaveBeenCalled();expect(f.md.roomDraft.discard).not.toHaveBeenCalled();
});


it('renders newly visited donor pages synchronously from one observed local snapshot', async () => {
 const f=fixture([['categories',category()]]);
 const provider=createHouseDataProvider(f.md as unknown as HouseRuntime,ROOM,{observed:true});
 provider.setObservedSnapshot({documents:f.documents});
 const client=new QueryClient({defaultOptions:{queries:{staleTime:Infinity,refetchOnMount:false,retry:false}}});
 const projection=connectLocalQueryProjection(client,provider);
 const queryFn=vi.fn(async()=>{throw new Error('Navigation must not fetch')});
 const params={pagination:{page:1,perPage:10},sort:{field:'id',order:'ASC' as const},filter:{}};
 const listObserver=new QueryObserver(client,{queryKey:['categories','getList',params],queryFn});
 expect(listObserver.getCurrentResult().isPending).toBe(false);
 expect((listObserver.getCurrentResult().data as any).data).toHaveLength(1);
 const recordObserver=new QueryObserver(client,{queryKey:['categories','getOne',{id:'category-1'}],queryFn});
 expect(recordObserver.getCurrentResult().isPending).toBe(false);
 const unsubscribe=recordObserver.subscribe(()=>{});
 expect(queryFn).not.toHaveBeenCalled();expect(f.md.query).not.toHaveBeenCalled();
 await provider.getList('categories',params);await provider.getOne('categories',{id:'category-1'});
 expect(f.md.query).not.toHaveBeenCalled();
 const updated=structuredClone(f.documents);updated[0].fields.name='Observed change';
 provider.setObservedSnapshot({documents:updated});projection.refresh();
 expect((recordObserver.getCurrentResult().data as any).name).toBe('Observed change');
 const infinite=provider.getLocalResult(['categories','getInfiniteList',params]);
 expect((infinite.value as any).pages[0].data).toHaveLength(1);
 unsubscribe();projection.close();client.clear();
});


it('never mutates the observed replica during local Save preparation or refusal', async () => {
 const f=fixture(); const provider=createHouseDataProvider(f.md as unknown as HouseRuntime,ROOM,{observed:true});
 provider.setObservedSnapshot({documents:[]});
 f.md.save.mockResolvedValueOnce({outcome:'refused',rule:'invalid-document'} as any);
 await expect(provider.create('categories',{data:category()})).rejects.toThrow('invalid-document');
 const view=provider.getLocalResult(['categories','getList',{pagination:{page:1,perPage:10},filter:{}}]);
 expect((view.value as any).data).toEqual([]); expect(f.md.query).not.toHaveBeenCalled();
});
