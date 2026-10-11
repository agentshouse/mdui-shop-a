import { useEffect, useMemo, useRef, useState } from 'react';
import { QueryClient } from '@tanstack/react-query';
import App from './App';
import { connectLocalQueryProjection } from './local-query-projection';
import {
    createHouseDataProvider, houseRuntime, observeRooms, observeShop,
    observeSyncStatus, observeRoomDrafts, observeServiceMode,
    observeStorageLoss, observeConnectionRefusal, observeQueue,
    type HouseRuntime,
} from './house';

type Room = Awaited<ReturnType<HouseRuntime['rooms']>>[number];
type Observation<T> = { current(): T; subscribe(listener: (value: T) => void): () => void; close(): void };
type Attention = { room: string; path: string };
const errorText = (error: unknown) => error instanceof Error ? error.message : String(error);

export default function HouseRoot() {
    const [runtime, setRuntime] = useState<HouseRuntime | null>(null);
    const [rooms, setRooms] = useState<readonly Room[]>([]);
    const [room, setRoom] = useState('');
    const [completed, setCompleted] = useState(false);
    const [hasSnapshot, setHasSnapshot] = useState(false);
    const available = useRef(false);
    const activeRoom = useRef(room);
    activeRoom.current = room;
    const [attempt, setAttempt] = useState(0);
    const [error, setError] = useState('');
    const [fatal, setFatal] = useState(false);
    const [refused, setRefused] = useState('');
    const [storageWarning, setStorageWarning] = useState('');
    const [resetWarning, setResetWarning] = useState(false);
    const [attention, setAttention] = useState<readonly Attention[]>([]);
    const [draftAttention, setDraftAttention] = useState<readonly Attention[]>([]);
    const [halted, setHalted] = useState(false);
    const [queue, setQueue] = useState({ waiting: 0, submitted: 0, accepted: 0, reset: 0 });

    useEffect(() => {
        let disposed = false;
        let latestRooms: readonly Room[] = []; let synced = false; let selected = ''; let denied = false;
        function refresh() {
            if (!selected && synced && latestRooms.length === 1) { selected = latestRooms[0].locator; setRoom(selected); }
            available.current = !disposed && !denied && synced && latestRooms.length === 1 && latestRooms[0].locator === selected;
        }
        const cleanups: (() => void)[] = [];
        async function listen<T>(promise: Promise<Observation<T>>, apply: (value: T) => void) {
            const observation = await promise;
            if (disposed) { observation.close(); return; }
            apply(observation.current());
            cleanups.push(observation.subscribe(value => { if (!disposed) apply(value); }), () => observation.close());
        }
        async function connect() {
            setFatal(false); setError(''); setCompleted(false); available.current = false; const md = await houseRuntime();
            if (disposed) return;
            setRuntime(md);
            await Promise.all([
                listen(observeRooms(md), values => {
                    latestRooms = values; setRooms(values); refresh();
                }),
                listen(observeSyncStatus(md), value => {
                    synced = typeof value.lastCompleted === 'string'; setCompleted(synced); refresh();
                    setAttention(value.attentionRequired);
                    setResetWarning(Boolean(value.reset));
                }),
                listen(observeRoomDrafts(md), value => setDraftAttention(value.filter(draft => Boolean(draft.returned)))),
                listen(observeServiceMode(md), value => setHalted(value === 'write-halted')),
                listen(observeStorageLoss(md), value => setStorageWarning(value ?? '')),
                listen(observeConnectionRefusal(md), value => { denied = Boolean(value); setRefused(value ? `House connection refused: ${value.reason}` : ''); refresh(); }),
            ]);
        }
        void connect().catch(value => { if (!disposed) { available.current = false; setError(errorText(value)); setFatal(true); } });
  return () => { disposed = true; available.current = false; cleanups.forEach(cleanup => cleanup()); };
    }, [attempt]);

    const ready = completed && rooms.length === 1 && rooms[0].locator === room;
    const queryClient = useMemo(() => new QueryClient({
        defaultOptions: { queries: { retry: false, staleTime: Infinity, refetchOnMount: false, refetchOnWindowFocus: false, meta: { room } }, mutations: { retry: false } },
    }), [room]);
    useEffect(() => () => queryClient.clear(), [queryClient]);
    const provider = useMemo(() => runtime && room ? createHouseDataProvider(runtime, room, {
        observed: true, isAvailable: () => available.current,
        onMutation: event => {
            if (activeRoom.current !== room) return;
            if (event.phase === 'error') setError(event.message);
            if (event.phase === 'queued') { setError(''); }
        },
    }) : null, [runtime, room]);

    useEffect(() => {
        setQueue({ waiting: 0, submitted: 0, accepted: 0, reset: 0 });
        if (!runtime || !room || !provider || !ready || fatal || refused) return;
        let disposed = false;
        const cleanups: (() => void)[] = [];
        async function watch<T>(promise: Promise<Observation<T>>, apply: (value: T) => void) {
            const observation = await promise;
            if (disposed) { observation.close(); return; }
            apply(observation.current());
            cleanups.push(observation.subscribe(value => { if (!disposed) apply(value); }), () => observation.close());
        }
        const projection = connectLocalQueryProjection(queryClient, provider);
        void Promise.all([
            watch(observeShop(runtime, room), value => { provider.setObservedSnapshot(value); projection.refresh(); setHasSnapshot(true); setError(''); }),
            watch(observeQueue(runtime, room), entries => {
                const summary = { waiting: 0, submitted: 0, accepted: 0, reset: 0 };
                entries.forEach(entry => { summary[entry.state]++; });
                setQueue(summary);
            }),
        ]).catch(value => { if (!disposed) setError(errorText(value)); });
  return () => { disposed = true; projection.close(); cleanups.forEach(cleanup => cleanup()); };
    }, [runtime, room, provider, ready, fatal, refused, queryClient]);

    const returnedPaths = [...new Set([...attention, ...draftAttention].filter(entry => entry.room === room).map(entry => entry.path))];
      const bindingError = !completed ? "" : rooms.length > 1 ? "This App received multiple data bindings. Check its configuration in House." : rooms.length === 0 ? "Attach a Shop Room to this App in House to begin." : room && rooms[0].locator !== room ? "The Shop data binding changed. Copy your open edits before reloading; they have not been moved." : "";
  return (
        <div className="house-shop">
            {(bindingError || error || refused) && <div role="alert" className="house-message house-error">{bindingError || refused || error}{fatal && <button onClick={() => setAttempt(value => value + 1)}>Retry connection</button>}</div>}
            {returnedPaths.length > 0 && <div role="alert" className="house-message house-warning"><strong>{returnedPaths.length} Room draft{returnedPaths.length === 1 ? '' : 's'} need attention.</strong> Resolve returned or conflicting drafts in House before editing those records again.<details><summary>Show affected documents</summary><ul>{returnedPaths.map(path => <li key={path}>{path}</li>)}</ul></details></div>}
            {storageWarning && <div role="alert" className="house-message house-warning">House storage warning: {storageWarning}. Check queued changes in House.</div>}
            {(resetWarning || queue.reset > 0) && <div role="alert" className="house-message house-warning">House reported a sync reset. Check Room drafts before retrying changes.</div>}
            {halted && <div role="status" className="house-message house-warning">House uploads are paused. Local drafts and Save remain available.</div>}
            {provider && hasSnapshot && <div hidden={!ready || fatal || Boolean(refused)} inert={!ready || fatal || Boolean(refused)}><App key={room} dataProvider={provider} queryClient={queryClient} /></div>}
            {(!provider || !hasSnapshot || !ready || fatal || refused) && <main className="house-empty"><h1>Shop Admin</h1><p>{fatal || refused ? 'The House connection needs attention before Shop Admin can load.' : !completed ? 'Loading data…' : bindingError ? 'Open edits are kept until the data binding returns.' : 'Loading data…'}</p></main>}
        </div>
    );
}
