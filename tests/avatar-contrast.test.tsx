import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { MemoryRouter } from 'react-router-dom';
import type { Customer, Order } from '../src/types';
import { PendingOrder } from '../src/dashboard/PendingOrder';
import PendingReviews from '../src/dashboard/PendingReviews';
import NewCustomers from '../src/dashboard/NewCustomers';
import AvatarField from '../src/visitors/AvatarField';
import { themes } from '../src/themes/themes';
import { cssVariablesTheme } from '../src/themes/cssVariablesTheme';
import { initialsAvatarSx } from '../src/visitors/initialsAvatarSx';

const state = vi.hoisted(() => ({
    customer: { id: '1', first_name: 'Ada', last_name: 'Stone', avatar: '' },
    pending: false,
}));
vi.mock('react-admin', async importOriginal => ({
    ...await importOriginal<typeof import('react-admin')>(),
    useTranslate: () => (value: string) => value,
    useReference: () => ({ referenceRecord: state.customer, isPending: state.pending }),
    useRecordContext: (props?: { record?: unknown }) => props?.record ?? state.customer,
    useGetList: () => ({ data: [{ id: '1', customer_id: '1', rating: 5, comment: 'Great print.' }], total: 1, isPending: false }),
    useIsDataLoaded: () => true,
    ReferenceField: ({ children }: { children: React.ReactNode }) => children,
    FunctionField: ({ render }: { render: (record: Customer) => React.ReactNode }) => render(state.customer as Customer),
    ListBase: ({ children }: { children: React.ReactNode }) => children,
    WithListContext: ({ render }: { render: (context: { total: number }) => React.ReactNode }) => render({ total: 1 }),
    SimpleList: ({ leftAvatar }: { leftAvatar: (record: Customer) => React.ReactNode }) => leftAvatar(state.customer as Customer),
}));
vi.mock('../src/RoomImage', () => ({
    RoomImage: ({ value }: { value: string }) => <img data-reference={value} alt="" />,
}));

const order = { id: '1', customer_id: '1', date: '2026-10-01T12:00:00Z', basket: [], total: 12 } as unknown as Order;
const palettes = [...themes.flatMap(theme => [
    ...(theme.light ? [{ name: `${theme.name} light`, options: theme.light }] : []),
    ...(theme.dark ? [{ name: `${theme.name} dark`, options: theme.dark }] : []),
    ...(theme.single && theme.name !== 'cssVariables' ? [{ name: theme.name, options: theme.single }] : []),
]), ...(['light', 'dark'] as const).map(mode => ({
    name: `cssVariables ${mode} resolved palette`,
    options: { palette: cssVariablesTheme.colorSchemes![mode]!.palette },
}))];

function channels(color: string): number[] {
    if (color.startsWith('#')) {
        const hex = color.slice(1);
        const full = hex.length === 3 ? Array.from(hex, digit => digit + digit).join('') : hex;
        return [0, 2, 4].map(offset => parseInt(full.slice(offset, offset + 2), 16));
    }
    const values = color.match(/[\d.]+/g)?.map(Number);
    if (!values || values.length < 3) throw new Error(`Unresolved color: ${color}`);
    return values;
}
function contrast(color: string, background: string) {
    const foreground = channels(color);
    const back = channels(background);
    const alpha = foreground[3] ?? 1;
    const composite = foreground.slice(0, 3).map((value, i) => value * alpha + back[i] * (1 - alpha));
    const luminance = (rgb: number[]) => rgb.slice(0, 3).reduce((total, value, i) => {
        const channel = value / 255;
        return total + (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4) * [0.2126, 0.7152, 0.0722][i];
    }, 0);
    const values = [luminance(composite), luminance(back)].sort((a, b) => b - a);
    return (values[0] + 0.05) / (values[1] + 0.05);
}

beforeEach(() => { state.pending = false; state.customer.avatar = ''; });
afterEach(cleanup);

describe.each(palettes)('initials foreground in $name', ({ options }) => {
    it('keeps all rendered initials readable without changing avatar backgrounds or sizes', () => {
        const theme = createTheme(options);
        const view = render(<ThemeProvider theme={theme}><MemoryRouter>
            <PendingOrder order={order} />
            <PendingReviews />
            <NewCustomers />
            <AvatarField sx={{ marginRight: '7px' }} />
        </MemoryRouter></ThemeProvider>);
        const avatars = Array.from(view.container.querySelectorAll<HTMLElement>('.MuiAvatar-root'));
        expect(avatars).toHaveLength(4);
        for (const avatar of avatars) {
            expect(avatar).toHaveTextContent('AS');
            const style = getComputedStyle(avatar);
            expect(contrast(style.color, style.backgroundColor), `${style.color} on ${style.backgroundColor}`).toBeGreaterThanOrEqual(4.5);
            expect(style.borderRadius).toBe('50%');
        }
        const paper = document.createElement('div');
        paper.style.backgroundColor = theme.palette.background.paper;
        for (const avatar of avatars.slice(0, 2)) {
            expect(getComputedStyle(avatar).backgroundColor).toBe(paper.style.backgroundColor);
            expect(getComputedStyle(avatar).width).toBe('40px');
        }
        const gray = document.createElement('div');
        gray.style.backgroundColor = theme.palette.grey[theme.palette.mode === 'dark' ? 600 : 400];
        for (const avatar of avatars.slice(2)) expect(getComputedStyle(avatar).backgroundColor).toBe(gray.style.backgroundColor);
        expect(getComputedStyle(avatars[3]).width).toBe('25px');
        expect(getComputedStyle(avatars[3]).marginRight).toBe('7px');
    });

    it('keeps the pending-reference initials readable', () => {
        state.pending = true;
        const view = render(<ThemeProvider theme={createTheme(options)}><MemoryRouter><PendingOrder order={order} /></MemoryRouter></ThemeProvider>);
        const style = getComputedStyle(view.container.querySelector('.MuiAvatar-root')!);
        expect(contrast(style.color, style.backgroundColor)).toBeGreaterThanOrEqual(4.5);
    });
});

it('pairs CSS-variable dark-mode initials with the same mode boundary as MUI Avatar', () => {
    expect(initialsAvatarSx(cssVariablesTheme)).toEqual({
        color: cssVariablesTheme.palette.getContrastText(cssVariablesTheme.palette.grey[400]),
        ...cssVariablesTheme.applyStyles('dark', {
            color: cssVariablesTheme.palette.getContrastText(cssVariablesTheme.palette.grey[600]),
        }),
    });
});

it('preserves the Room portrait path and caller styling', () => {
    state.customer.avatar = 'at_c.8';
    const view = render(<ThemeProvider theme={createTheme()}><AvatarField size="45" sx={{ marginRight: '7px' }} /></ThemeProvider>);
    const avatar = view.container.querySelector('.MuiAvatar-root')!;
    expect(avatar).not.toHaveTextContent('AS');
    expect(avatar.querySelector('img')).toHaveAttribute('data-reference', 'at_c.8');
    expect(getComputedStyle(avatar).width).toBe('45px');
    expect(getComputedStyle(avatar).marginRight).toBe('7px');
});
