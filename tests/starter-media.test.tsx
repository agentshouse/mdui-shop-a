import { cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { RoomImage } from '../src/RoomImage';
const { provider, observe } = vi.hoisted(() => ({ provider: { getAttachment: vi.fn() }, observe: vi.fn() }));
vi.mock('react-admin', () => ({ useDataProvider: () => provider }));
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('IntersectionObserver', class { observe = observe; disconnect() {} });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it.each([undefined, null, ''])('renders text-only starter media %j without an image element or attachment read', value => {
  const view = render(<><RoomImage value={value} alt="Cat Nose" /><RoomImage value={value} alt="animals" /></>);
  expect(view.container.querySelectorAll('img')).toHaveLength(0);
  expect(view.getByRole('img', { name: 'Cat Nose: No image' })).toHaveTextContent('No image');
  expect(view.getByRole('img', { name: 'animals: No image' })).toHaveTextContent('No image');
  expect(provider.getAttachment).not.toHaveBeenCalled();
});
it('observes an image added after a missing-media placeholder', () => {
  const view = render(<RoomImage alt="Cat Nose" />);
  expect(observe).not.toHaveBeenCalled();
  view.rerender(<RoomImage value="at_c.8" alt="Cat Nose" />);
  expect(view.getByAltText('Cat Nose')).toHaveAttribute('loading', 'lazy');
  expect(observe).toHaveBeenCalledWith(view.getByAltText('Cat Nose'));
  expect(provider.getAttachment).not.toHaveBeenCalled();
});
