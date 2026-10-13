// @vitest-environment node
import { expect, onTestFinished, test, vi } from 'vitest';
import { IDBFactory } from 'fake-indexeddb';
import { connectMdRuntime } from '@agentshouse/mdruntime/client';
import { serveMdRuntime } from '@agentshouse/mdruntime/host';
import { createMemoryAdapter, type MemoryRoom } from '@agentshouse/mdruntime/memory';
import { createHouseDataProvider, type HouseRuntime } from '../src/house';

test('the App reads a real Runtime binary record using its parent directory and exact identity', async () => {
  vi.stubGlobal('indexedDB', new IDBFactory());
  const locator = 'binary-test';
  const room: MemoryRoom = {
    name: 'Binary test', locator, handle: locator, roomVersion: 'one',
    operations: { read: [''], sync: [''], write: [''], delete: [''] },
    replica: { selection: locator, admission: 'admitted' }, providerOwnedPaths: [],
    model: { kind: 'model', snapshot: { identity: locator, version: '1', revision: 'one', schema: null } },
    documents: { 'welcome.md': '# Binary fixture\n' },
  };
  const adapter = createMemoryAdapter({ rooms: [room] });
  const stopped = new AbortController();
  const host = serveMdRuntime({ adapter, signal: stopped.signal, shell: {
    persistentStorage: true, generation: null, keepGeneration() {}, dropGeneration() {},
  } });
  const channel = new MessageChannel();
  host.attach(channel.port1, 'binary-test', undefined, { rooms: [locator], documents: [], conversations: false });
  const client = connectMdRuntime(channel.port2) as HouseRuntime;
  onTestFinished(() => { stopped.abort(); channel.port1.close(); channel.port2.close(); vi.unstubAllGlobals(); });
  await vi.waitFor(async () => expect((await client.rooms())[0]?.roomVersion).toBe('one'));
  adapter.notifyServiceMode('write-halted');
  const path = 'images/native-fixture';
  const file = new File(['retained bytes'], 'note.txt', {type:'text/plain'});
  const draft = await client.roomDraft.write(locator, path, null, {file:{blob:file}});
  if (draft.outcome !== 'written' || !draft.roomDraft) throw new Error('Fixture draft was refused');
  expect(await client.save(locator, [{path,revision:draft.roomDraft.revision}])).toMatchObject({outcome:'saved'});
  const provider = createHouseDataProvider(client, locator);
  const result = await provider.getAttachment(path);
  expect(result.status).toBe('available');
  expect(await result.blob!.text()).toBe('retained bytes');
  await expect(provider.getAttachment('images/native-fixture-other')).rejects.toThrow('not declared');
  await vi.waitFor(async () => {
    const records = await client.query({rooms:[locator],pathPrefix:'images',select:'all'});
    expect(records).toMatchObject({documents:[{path,binaryFile:{byteLength:14,mediaType:'text/plain'}}]});
  }, {timeout:3000});
});
