import poster01 from './assets/posters/01.svg';
import poster02 from './assets/posters/02.svg';
import poster03 from './assets/posters/03.svg';
import poster04 from './assets/posters/04.svg';
import poster05 from './assets/posters/05.svg';
import poster06 from './assets/posters/06.svg';
import poster07 from './assets/posters/07.svg';
import poster08 from './assets/posters/08.svg';
import poster09 from './assets/posters/09.svg';
import poster10 from './assets/posters/10.svg';
import poster11 from './assets/posters/11.svg';
import poster12 from './assets/posters/12.svg';
/** Imported local assets only. Room text must never become a network image URL. */
export const posterChoices = [
    { id: '/posters/01.svg', name: 'Sunrise study' },
    { id: '/posters/02.svg', name: 'Forest geometry' },
    { id: '/posters/03.svg', name: 'Blue hour' },
    { id: '/posters/04.svg', name: 'Desert forms' },
    { id: '/posters/05.svg', name: 'Petal rhythm' },
    { id: '/posters/06.svg', name: 'Ocean lines' },
    { id: '/posters/07.svg', name: 'Night orbit' },
    { id: '/posters/08.svg', name: 'Coral blocks' },
    { id: '/posters/09.svg', name: 'Sage horizon' },
    { id: '/posters/10.svg', name: 'City silhouettes' },
    { id: '/posters/11.svg', name: 'Golden arch' },
    { id: '/posters/12.svg', name: 'Violet balance' },
];
const assets: Readonly<Record<string, string>> = {
    '/posters/01.svg': poster01,
    '/posters/02.svg': poster02,
    '/posters/03.svg': poster03,
    '/posters/04.svg': poster04,
    '/posters/05.svg': poster05,
    '/posters/06.svg': poster06,
    '/posters/07.svg': poster07,
    '/posters/08.svg': poster08,
    '/posters/09.svg': poster09,
    '/posters/10.svg': poster10,
    '/posters/11.svg': poster11,
    '/posters/12.svg': poster12,
};
export function isAttachmentReference(value: unknown): value is string {
    return typeof value === 'string' && value.includes('/') && !value.includes("\0") && !/[\\:?#]/.test(value) && value.split('/').every(part => part !== '' && part !== '.' && part !== '..');
}
export function safePoster(value: unknown): string | undefined {
    return typeof value === 'string' && Object.hasOwn(assets, value) ? assets[value] : undefined;
}
export function initials(person?: { first_name?: string; last_name?: string }): string {
    return `${person?.first_name?.[0] ?? ''}${person?.last_name?.[0] ?? ''}`.toUpperCase() || '?';
}
