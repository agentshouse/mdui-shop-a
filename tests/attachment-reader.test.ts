import { Blob } from 'node:buffer';
import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { createHouseDataProvider, type HouseRuntime } from '../src/house';
vi.mock('@agentshouse/app-bridge', () => ({ houseBridge: vi.fn() }));
const ROOM = 'r_19.z';
const PATH = 'images/animals-1.jpeg';
const bytes = new Uint8Array([255, 216, 255, 224, 0]);
function fixture(patch: Record<string, unknown> = {}) {
  const metadata = { state: 'accepted', path: PATH, revision: 'v1', fileRef: 'file-fixture', byteLength: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), mediaType: 'image/jpeg', ...patch };
  const md = {
    query: vi.fn().mockResolvedValue({ documents: [{ room: ROOM, path: PATH, binaryFile: metadata }] }),
    binaryFile: { read: vi.fn().mockResolvedValue({ kind: 'binary', blob: new Blob([bytes], { type: 'image/jpeg' }) }) },
    call: vi.fn(),
  };
  return { md, provider: createHouseDataProvider(md as unknown as HouseRuntime, ROOM) };
}
describe('Room binary image read', () => {
  it('reads only the exact Room path and verifies size and SHA-256', async () => {
    const { md, provider } = fixture();
    expect(await provider.getAttachment(PATH)).toMatchObject({ status: 'available', name: 'animals-1.jpeg' });
    expect(md.query).toHaveBeenCalledWith({ rooms: [ROOM], pathPrefix: 'images', select: 'all' });
    expect(md.binaryFile.read).toHaveBeenCalledWith(ROOM, PATH);
    expect(md.call).not.toHaveBeenCalled();
  });
  it.each(['https://example.test/a', 'blob:temporary', '../outside.jpg', 'images/../outside.jpg', '/images/file.jpg', 'images/file?query', 'at_old'])('rejects %s before reading', async value => {
    const { md, provider } = fixture();
    await expect(provider.getAttachment(value)).rejects.toThrow('path');
    expect(md.query).not.toHaveBeenCalled();
    expect(md.binaryFile.read).not.toHaveBeenCalled();
  });
  it.each([{ room: 'r_other', path: PATH }, { room: ROOM, path: `${PATH}.other` }])('refuses a different Room or prefix-only match', async scope => {
    const { md, provider } = fixture();
    md.query.mockResolvedValueOnce({ documents: [{ ...scope, binaryFile: {} }] });
    await expect(provider.getAttachment(PATH)).rejects.toThrow('not declared');
    expect(md.binaryFile.read).not.toHaveBeenCalled();
  });
  it.each([[{ byteLength: 999 }, 'byte length'], [{ sha256: '0'.repeat(64) }, 'SHA-256']] as const)('rejects mismatched metadata', async (patch, message) => {
    await expect(fixture(patch).provider.getAttachment(PATH)).rejects.toThrow(message);
  });
  it('handles a new refusal without falling back to a URL or retrying', async () => {
    const { md, provider } = fixture();
    md.binaryFile.read.mockResolvedValueOnce({ kind: 'rejected', code: 'new_refusal', retryable: true });
    expect(await provider.getAttachment(PATH)).toMatchObject({ blob: null, status: 'unavailable' });
    expect(md.binaryFile.read).toHaveBeenCalledTimes(1);
  });
  it('does not complete a read after the data binding changes', async () => {
    let available = true;
    const { md } = fixture();
    const provider = createHouseDataProvider(md as unknown as HouseRuntime, ROOM, { isAvailable: () => available });
    const read = provider.getAttachment(PATH); available = false;
    await expect(read).rejects.toThrow('not ready');
  });
});
