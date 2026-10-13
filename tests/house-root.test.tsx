import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const harness = vi.hoisted(() => ({ signals: new Map<string, any>(), provider: vi.fn(), connect: vi.fn() }));
function observation(key: string, initial: unknown) {
    if (!harness.signals.has(key)) {
        let value = initial;
        const listeners = new Set<(value: unknown) => void>();
        harness.signals.set(key, {
            current: () => value,
            subscribe: (callback: (value: unknown) => void) => { listeners.add(callback); return () => listeners.delete(callback); },
            close: vi.fn(),
            emit: (next: unknown) => { value = next; listeners.forEach(callback => callback(next)); },
            listeners,
        });
    }
    return Promise.resolve(harness.signals.get(key));
}
vi.mock('../src/house', () => ({
    houseRuntime: () => harness.connect(),
    createHouseDataProvider: (...args: unknown[]) => harness.provider(...args),
    observeRooms: () => observation('rooms', [{ locator: 'room-a', name: 'First shop' }]),
    observeSyncStatus: () => observation('sync', { state: 'synced', lastCompleted: '2026-10-11T13:00:00Z', providerUnreachable: false, attentionRequired: [], reset: null }),
    observeRoomDrafts: () => observation('drafts', []),
    observeServiceMode: () => observation('mode', 'open'),
    observeStorageLoss: () => observation('storage', null),
    observeConnectionRefusal: () => observation('refusal', null),
    observeShop: (_runtime: unknown, room: string) => observation(`shop:${room}`, []),
    observeQueue: (_runtime: unknown, room: string) => observation(`queue:${room}`, []),
}));
vi.mock('../src/App', () => ({ default: ({ dataProvider }: { dataProvider: { room: string } }) => <div data-testid="shop-app">{dataProvider.room}<input aria-label="Unsaved Shop edit" defaultValue="" /></div> }));
import HouseRoot from '../src/HouseRoot';

beforeEach(() => {
    harness.signals.clear();
    harness.provider.mockReset().mockImplementation((_runtime, room) => ({ room, setObservedSnapshot: vi.fn(), getLocalResult: () => ({handled:false}) }));
    harness.connect.mockReset().mockResolvedValue({});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
const emit = (key: string, value: unknown) => act(() => harness.signals.get(key).emit(value));

async function openShop() {
    render(<HouseRoot />);
    await waitFor(() => expect(screen.getByTestId('shop-app')).toHaveTextContent('room-a'));
    await waitFor(() => expect(harness.signals.has('queue:room-a')).toBe(true));
}

describe('House Room wrapper', () => {
    it('waits for House and uses the selected Room only', async () => {
        await openShop();
        expect(screen.queryByText('Synced to House')).not.toBeInTheDocument();
        expect(harness.provider.mock.calls[0][1]).toBe('room-a');
        expect(screen.queryByText(/imaginary|demo|username/i)).not.toBeInTheDocument();
    });
    it('rejects ambiguous host bindings and isolates observers after replacement', async () => {
        await openShop();
        emit('rooms', [{locator: 'room-a', name: 'First shop'}, {locator: 'room-b', name: 'Second shop'}]);
        expect(await screen.findByText(/received multiple data bindings/)).toBeInTheDocument();
        expect(screen.getByTestId('shop-app')).not.toBeVisible();
        expect(screen.queryByLabelText('Shop Room')).not.toBeInTheDocument();
        emit('rooms', [{locator: 'room-b', name: 'Second shop'}]);
        await screen.findByText(/Shop data binding changed/);
        expect(screen.getByTestId('shop-app')).toHaveTextContent('room-a');
        expect(harness.signals.get('queue:room-a').listeners.size).toBe(0);
        emit('queue:room-a', [{ state: 'reset' }]);
        expect(screen.queryByText(/reported a sync reset/)).not.toBeInTheDocument();
        expect(harness.provider.mock.calls.at(-1)?.[1]).toBe('room-a');
        emit('rooms', [{locator: 'room-a', name: 'First shop'}]);
        await waitFor(() => expect(screen.getByTestId('shop-app')).toBeVisible());
    });
    it('shows queued, offline, reset and accepted-but-not-visible states honestly', async () => {
        await openShop();
        emit('sync', { state: 'pending', lastCompleted: '2026-10-11T13:00:00Z', providerUnreachable: true, attentionRequired: [], reset: null });
        expect(screen.queryByText('Offline · changes waiting')).not.toBeInTheDocument();
        emit('queue:room-a', [{ state: 'waiting' }, { state: 'submitted' }, { state: 'accepted' }, { state: 'reset' }]);
        expect(screen.queryByText('4 Room change batches')).not.toBeInTheDocument();
        expect(screen.queryByText(/Accepted, awaiting visibility: 1/)).not.toBeInTheDocument();
        expect(screen.getByText(/reported a sync reset/)).toBeInTheDocument();
    });
    it('filters conflict notices to the active Room and clears resolved attention', async () => {
        await openShop();
        emit('drafts', [{ room: 'room-b', path: 'other.md', returned: { kind: 'conflicted' } }]);
        expect(screen.queryByText(/need attention/)).not.toBeInTheDocument();
        emit('drafts', [{ room: 'room-a', path: 'products/art.md', returned: { kind: 'conflicted' } }]);
        expect(screen.getByText('products/art.md')).toBeInTheDocument();
        emit('drafts', []);
        expect(screen.queryByText('products/art.md')).not.toBeInTheDocument();
    });
    it('keeps forms mounted during a write halt and surfaces storage warnings', async () => {
        await openShop();
        emit('mode', 'write-halted');
        expect(screen.getByText(/uploads are paused/)).toBeInTheDocument();
        expect(screen.getByTestId('shop-app')).toBeInTheDocument();
        emit('storage', 'disk unavailable');
        expect(screen.getByText(/disk unavailable/)).toBeInTheDocument();
    });
    it('does not add storage selectors or sync status during mutations', async () => {
        await openShop();
        const callback = harness.provider.mock.calls[0][2].onMutation;
        act(() => callback({ phase: 'saving', message: 'Preparing' }));
        expect(screen.queryByLabelText('Shop Room')).not.toBeInTheDocument();
        act(() => callback({ phase: 'queued', message: 'Queued' }));
        expect(screen.queryByText('Changes queued')).not.toBeInTheDocument();
        expect(screen.queryByLabelText('Shop Room')).not.toBeInTheDocument();
    });
    it('blocks access on refusal and resumes if refusal clears', async () => {
        await openShop();
        emit('refusal', { code: 'revoked', retryable: false });
        expect(screen.getByRole('alert')).toHaveTextContent('revoked');
        expect(screen.getByTestId('shop-app')).not.toBeVisible();
        emit('refusal', null);
        expect(screen.getByTestId('shop-app')).toBeInTheDocument();
    });
    it('offers retry after an initial connection failure', async () => {
        harness.connect.mockRejectedValueOnce(new Error('Bridge unavailable'));
        render(<HouseRoot />);
        await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Bridge unavailable'));
        expect(screen.queryByTestId('shop-app')).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Retry connection' }));
        await waitFor(() => expect(screen.getByTestId('shop-app')).toHaveTextContent('room-a'));
    });
    it('closes observations when unmounted', async () => {
        await openShop();
        cleanup();
        for (const signal of harness.signals.values()) {
            expect(signal.close).toHaveBeenCalled();
            expect(signal.listeners.size).toBe(0);
        }
    });
});

it('waits for first sync, reports completed missing reach and recovers on late arrival', async () => {
 await observation('rooms', []); await observation('sync', {lastCompleted:null,attentionRequired:[],reset:null});render(<HouseRoot/>);
 await screen.findByText('Loading data…');expect(screen.queryByRole('alert')).not.toBeInTheDocument();expect(harness.provider).not.toHaveBeenCalled();
 emit('sync',{lastCompleted:'2026-10-11T13:00:00Z',attentionRequired:[],reset:null});await screen.findByText('Attach a Shop Room to this App in House to begin.');
 emit('rooms',[{locator:'room-a',name:'First shop'}]);await waitFor(()=>expect(screen.getByTestId('shop-app')).toBeVisible());expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});
it('waits when a Room arrives before first sync completion', async () => {
 await observation('sync',{lastCompleted:null,attentionRequired:[],reset:null});render(<HouseRoot/>);await screen.findByText('Loading data…');expect(harness.provider).not.toHaveBeenCalled();
 emit('sync',{lastCompleted:'2026-10-11T13:00:00Z',attentionRequired:[],reset:null});await screen.findByTestId('shop-app');
});
it('retains unsaved form DOM and blocks provider access through temporary reach loss', async () => {
 await openShop();const input=screen.getByLabelText('Unsaved Shop edit');fireEvent.change(input,{target:{value:'unsubmitted text'}});
 const options=harness.provider.mock.calls[0][2];expect(options.isAvailable()).toBe(true);
 emit('rooms',[]);expect(options.isAvailable()).toBe(false);expect(input).not.toBeVisible();expect(input).toHaveValue('unsubmitted text');
 emit('rooms',[{locator:'room-a',name:'First shop'}]);await waitFor(()=>expect(input).toBeVisible());expect(input).toHaveValue('unsubmitted text');expect(options.isAvailable()).toBe(true);
});
