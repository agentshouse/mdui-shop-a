// @vitest-environment node
import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { createHouseDataProvider, type HouseRuntime } from '../src/house';
vi.mock('@agentshouse/app-bridge', () => ({ connectHouseBridge: vi.fn() }));
const ROOM = 'r_19.z';
const bytes = new Uint8Array([255, 216, 255, 224, 0]);
function fixture(patch: Record<string, any> = {}) {
    const record = { original: 'original-1', version: 'v1', attachment: 'at_c.8', name: 'animals-1.jpeg', bytes: bytes.length,
        sha256: createHash('sha256').update(bytes).digest('hex'), media_type: 'image/jpeg', save: { status: 'saved', failure: null }, storage: { provider: 'house', scope: ROOM },
        read: { status: 'available' }, blob: new Blob([bytes], { type: 'image/jpeg' }), ...patch };
    const md = { call: vi.fn().mockResolvedValue({ kind: 'action', result: record }) };
    return { md, provider: createHouseDataProvider(md as unknown as HouseRuntime, ROOM) };
}
describe('scoped attachment runtime read', () => {
    it('uses the documented action with the selected Room and verifies bytes and SHA-256', async () => {
        const { md, provider } = fixture();
        expect(await provider.getAttachment('at_c.8')).toMatchObject({ status: 'available', name: 'animals-1.jpeg' });
        expect(md.call).toHaveBeenCalledWith('attachments/get', { room_ref: ROOM, attachment_ref: 'at_c.8' });
    });
    it.each(['https://example.test/a', 'blob:temporary', 'at_bad/path', 'at_bad\\path', 'at_bad?query', 'at_', 'at_a b'])('refuses a non-reference %s before calling Runtime', async value => {
        const { md, provider } = fixture();
        await expect(provider.getAttachment(value)).rejects.toThrow('reference');
        expect(md.call).not.toHaveBeenCalled();
    });
    it.each([
        [{ attachment: 'at_other.a' }, 'different attachment'],
        [{ storage: { provider: 'house', scope: 'r_other.x' } }, 'selected House Room'],
        [{ bytes: 999 }, 'byte length'],
        [{ sha256: '0'.repeat(64) }, 'SHA-256'],
        [{ blob: undefined }, 'without Blob'],
        [{ blob: 'https://example.test/a' }, 'Runtime must return a Blob'],
        [{ read: { status: 'unavailable' } }, 'incompatible read status'],
        [{ src: 'https://example.test/a' }, 'result keys'],
    ])('refuses invalid attachment metadata or bytes: %j', async (patch, message) => {
        await expect(fixture(patch).provider.getAttachment('at_c.8')).rejects.toThrow(message as string);
    });
    it('exposes unavailable state without fallback download URLs', async () => {
        expect(await fixture({ read: { status: 'unavailable' }, blob: undefined }).provider.getAttachment('at_c.8')).toMatchObject({ blob: null, status: 'unavailable' });
    });
    it('does not complete a late image read after the data binding becomes unavailable', async () => {
        let available = true;
        const { md } = fixture();
        const provider = createHouseDataProvider(md as unknown as HouseRuntime, ROOM, { isAvailable: () => available });
        const read = provider.getAttachment('at_c.8'); available = false;
        await expect(read).rejects.toThrow('not ready');
    });
});

it('reads the complete image-linked donor dataset without any image fetch', async () => {
    const { readFileSync } = await import('node:fs');
    const { readShop, definitions } = await import('../src/house');
    const records = JSON.parse(readFileSync(new URL('../scripts/donor-demo/records.json', import.meta.url), 'utf8'));
    const documents = Object.entries(records).flatMap(([resource, rows]) => (rows as any[]).map(row => ({
        room: ROOM, path: `shop/${resource}/${row.id}.md`, type: definitions[resource as keyof typeof definitions].type,
        fields: { type: definitions[resource as keyof typeof definitions].type, ...Object.fromEntries(Object.entries(row).map(([key, value]) => [key, typeof value === 'boolean' ? String(value) : value != null && typeof value === 'object' ? JSON.stringify(value) : value])) },
    })));
    const db = readShop({ documents }, ROOM);
    expect(db.products).toHaveLength(130);
    expect(db.categories.filter(row => row.image)).toHaveLength(13);
    expect(db.customers.filter(row => row.avatar)).toHaveLength(223);
    expect(db.products[0]).toMatchObject({ image: 'at_c.8', thumbnail: 'at_c.8' });
});


it.each(['', 'application/octet-stream'])('preserves generic transport MIME %j with null declared metadata after scope/hash verification', async type => {
    const result = await fixture({ media_type: null, blob: new Blob([bytes], { type }) }).provider.getAttachment('at_c.8');
    expect(result.type).toBeNull();
    expect(result.blob?.type).toBe(type);
    expect(new Uint8Array(await result.blob!.arrayBuffer())).toEqual(bytes);
});
