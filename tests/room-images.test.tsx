import { act, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RoomImage, isSafeRaster } from '../src/RoomImage';
const { provider } = vi.hoisted(() => ({ provider: { getAttachment: vi.fn() } }));
vi.mock('react-admin', () => ({ useDataProvider: () => provider }));
let enter: IntersectionObserverCallback;
const disconnect = vi.fn();
const jpeg = () => new Blob([new Uint8Array([255, 216, 255, 224, 1, 2])], { type: 'image/jpeg' });
beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('IntersectionObserver', class { constructor(callback: IntersectionObserverCallback) { enter = callback; } observe() {} disconnect = disconnect; });
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:verified-room-image');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    provider.getAttachment.mockResolvedValue({ blob: jpeg(), name: 'animals-1.jpeg', type: 'image/jpeg', status: 'available' });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
async function intersect() { await act(async () => enter([{ isIntersecting: true }] as IntersectionObserverEntry[], {} as IntersectionObserver)); }
describe('lazy Room image boundary', () => {
    it('does not read until near viewport, then renders only a verified blob URL and revokes it', async () => {
        const view = render(<RoomImage value="at_c.8" alt="Cat Nose" />);
        expect(provider.getAttachment).not.toHaveBeenCalled();
        const img = view.getByAltText('Cat Nose');
        expect(img).toHaveAttribute('loading', 'lazy');
        expect(img).not.toHaveAttribute('src');
        await intersect();
        await waitFor(() => expect(img).toHaveAttribute('src', 'blob:verified-room-image'));
        expect(provider.getAttachment).toHaveBeenCalledWith('at_c.8');
        view.unmount();
        expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:verified-room-image');
    });
    it('never renders a supplied URL or substitutes a missing-image picture', async () => {
        const view = render(<RoomImage value="https://example.test/track" alt="" />);
        await intersect();
        expect(provider.getAttachment).not.toHaveBeenCalled();
        expect(view.container.querySelector('img')).not.toHaveAttribute('src');
    });
    it('rejects executable bytes, mismatched raster signatures, unsupported and oversized files', async () => {
        for (const blob of [new Blob(['<svg/>'], { type: 'image/svg+xml' }), new Blob(['<html/>'], { type: 'image/jpeg' }), new Blob([new Uint8Array(10 * 1024 * 1024 + 1)], { type: 'image/jpeg' })]) expect(await isSafeRaster(blob)).toBe(false);
        expect(await isSafeRaster(jpeg())).toBe(true);
        provider.getAttachment.mockResolvedValue({ blob: new Blob(['<svg/>'], { type: 'image/jpeg' }), status: 'available' });
        const view = render(<RoomImage value="at_c.8" alt="" />);
        await intersect();
        await waitFor(() => expect(view.container.querySelector('img')).toHaveAttribute('title', 'The Room file is not a supported raster image.'));
        expect(URL.createObjectURL).not.toHaveBeenCalled();
    });
    it('discards a late result when value changes or the component unmounts', async () => {
        let resolve!: (value: any) => void;
        provider.getAttachment.mockReturnValue(new Promise(r => { resolve = r; }));
        const view = render(<RoomImage value="at_c.8" alt="" />);
        await intersect();
        view.rerender(<RoomImage value="" alt="" />);
        await act(async () => resolve({ blob: jpeg(), status: 'available' }));
        expect(URL.createObjectURL).not.toHaveBeenCalled();
        expect(view.container.querySelector('img')).not.toHaveAttribute('src');
    });
    it('does not fall back to a URL when bytes are missing', async () => {
        provider.getAttachment.mockResolvedValue({ blob: null, status: 'unavailable' });
        const view = render(<RoomImage value="at_c.8" alt="" />);
        await intersect();
        await waitFor(() => expect(view.container.querySelector('img')).toHaveAttribute('title', 'The Room image could not be read.'));
        expect(view.container.querySelector('img')).not.toHaveAttribute('src');
    });
});

it('clears the previous object URL before showing another record image', async () => {
    URL.createObjectURL = vi.fn().mockReturnValueOnce('blob:first').mockReturnValueOnce('blob:second');
    const view = render(<RoomImage value="at_c.8" alt="" />);
    await intersect();
    await waitFor(() => expect(view.container.querySelector('img')).toHaveAttribute('src', 'blob:first'));
    let resolve!: (value: any) => void;
    provider.getAttachment.mockReturnValue(new Promise(r => { resolve = r; }));
    view.rerender(<RoomImage value="at_h.2" alt="" />);
    expect(view.container.querySelector('img')).not.toHaveAttribute('src');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:first');
    await act(async () => resolve({ blob: jpeg(), status: 'available' }));
    await waitFor(() => expect(view.container.querySelector('img')).toHaveAttribute('src', 'blob:second'));
});
