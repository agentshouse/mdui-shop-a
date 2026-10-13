import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

const state = vi.hoisted(() => ({
    reviews: undefined as undefined | { id: number; customer_id: number; rating: number; comment: string }[],
    isPending: true,
    customerData: vi.fn(() => true),
}));
vi.mock('react-admin', async importOriginal => ({
    ...await importOriginal<typeof import('react-admin')>(),
    useGetList: () => ({ data: state.reviews, total: state.reviews?.length ?? 0, isPending: state.isPending }),
    useTranslate: () => (text: string) => text,
    useIsDataLoaded: state.customerData,
    ReferenceField: () => null,
}));
import PendingReviews from '../src/dashboard/PendingReviews';

beforeEach(() => { state.customerData.mockClear(); state.reviews = undefined; state.isPending = true; });
afterEach(cleanup);

it('renders while loading and after a Starter Room has no reviews', () => {
    const view = render(<MemoryRouter><PendingReviews /></MemoryRouter>);
    expect(screen.getByText('pos.dashboard.pending_reviews')).toBeInTheDocument();
    expect(state.customerData).toHaveBeenLastCalledWith(['customers', 'getMany', { ids: [] }], { enabled: false });
    state.reviews = [];
    state.isPending = false;
    view.rerender(<MemoryRouter><PendingReviews /></MemoryRouter>);
    expect(screen.getByText('pos.dashboard.all_reviews')).toBeInTheDocument();
    expect(state.customerData).toHaveBeenLastCalledWith(['customers', 'getMany', { ids: [] }], { enabled: false });
});

it('loads the customer only once a review exists, including customer zero', () => {
    state.reviews = [{ id: 1, customer_id: 0, rating: 3, comment: 'Review fixture' }];
    state.isPending = false;
    render(<MemoryRouter><PendingReviews /></MemoryRouter>);
    expect(state.customerData).toHaveBeenLastCalledWith(['customers', 'getMany', { ids: ['0'] }], { enabled: true });
    expect(screen.getByText('Review fixture')).toBeInTheDocument();
});
