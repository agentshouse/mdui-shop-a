// @vitest-environment node
import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
// @ts-expect-error Offline read-only JavaScript migration planner.
import { imageTargets, planFields } from './support/plan-donor-images.mjs';
// @ts-expect-error Offline JavaScript fixture.
import { seedRecords, serializeSeedRecord } from './support/donor-seed-data.mjs';
it('maps 130 products, 13 category covers and exactly 223 donor portraits', () => {
    const targets = imageTargets();
    expect(targets).toHaveLength(366);
    const map = JSON.parse(readFileSync(new URL('./support/donor-demo/poster-attachments.json', import.meta.url), 'utf8'));
    expect(Object.keys(map.attachments)).toHaveLength(379);
    const counts = { products: 0, categories: 0, customers: 0 };
    for (const target of targets) {
        const resource = target.path.split('/')[4] as keyof typeof counts;
        counts[resource]++;
        for (const reference of Object.values(target.fields)) expect(Object.keys(map.attachments).map(name => `images/${name}`)).toContain(reference);
    }
    expect(counts).toEqual({ products: 130, categories: 13, customers: 223 });
    expect(seedRecords.products[0]).toMatchObject({ image: 'images/animals-1.jpeg', thumbnail: 'images/animals-1.jpeg' });
    expect(seedRecords.categories[0].image).toBe('images/animals-1.jpeg');
    expect(seedRecords.customers.find((row: any) => row.avatar).avatar).toBe('images/avatar-0.jpeg');
});
it('plans only exact-base image fields and refuses changed artwork, wrong type or ID', () => {
    const target = imageTargets().find((target: any) => target.type === 'shop_product');
    const row = seedRecords.products.find((row: any) => row.id === target.id);
    const old = serializeSeedRecord('products', { ...row, image: '', thumbnail: '' });
    expect(planFields(target, old)).toEqual(['image', 'thumbnail'].map(field => ({ op: 'set_field', path: target.path, field, base: '', value: target.fields[field] })));
    expect(planFields(target, serializeSeedRecord('products', row))).toEqual([]);
    expect(() => planFields(target, serializeSeedRecord('products', { ...row, image: 'images/changed.a.jpg' }))).toThrow('Changed image');
    expect(() => planFields(target, old.replace('shop_product', 'shop_customer'))).toThrow('Wrong type');
    expect(() => planFields(target, old.replace(row.id, 'donor-other'))).toThrow('Wrong ID');
});
it('uses absent-field bases for newly supported optional category images', () => {
    const target = imageTargets().find((target: any) => target.type === 'shop_category');
    const row = seedRecords.categories.find((row: any) => row.id === target.id);
    const { image: _image, ...before } = row;
    expect(planFields(target, serializeSeedRecord('categories', before))).toEqual([{ op: 'set_field', path: target.path, field: 'image', value: row.image }]);
});

it('distinguishes absence from null and preserves the empty-string guard', () => {
    const target = imageTargets().find((target: any) => target.type === 'shop_category');
    const row = seedRecords.categories.find((row: any) => row.id === target.id);
    const markdown = serializeSeedRecord('categories', { ...row, image: '' });
    expect(planFields(target, markdown)[0]).toHaveProperty('base', '');
    expect(() => planFields(target, markdown.replace('image: ""', 'image: null'))).toThrow('Changed image');
});
