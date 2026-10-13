import { houseBridge } from '@agentshouse/app-bridge';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { Window } from 'happy-dom';
import { createHouseBridgeTestHost } from '@agentshouse/app-bridge/test-host';

// A local DOM/VM regression check, not hosted/browser or Room acceptance.
const root = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(root, 'dist/index.html'), 'utf8');
const entry = html.match(/<script[^>]+src="([^"]+\.js)"/)[1];
const filename = path.resolve(root, 'dist', entry);
assert(filename.startsWith(path.join(root, 'dist') + path.sep));
const source = fs.readFileSync(filename, 'utf8');
const { seedRecords: donorRecords } = await import('../tests/support/donor-seed-data.mjs');
const donorTypes = { products: 'shop_product', categories: 'shop_category', customers: 'shop_customer', orders: 'shop_order', invoices: 'shop_invoice', reviews: 'shop_review' };
const nativeDocuments = Object.entries(donorRecords).flatMap(([resource, rows]) => rows.map(row => ({
    room: 'local-test-room', path: `shop/${resource}/${row.id}.md`, type: donorTypes[resource],
    fields: { type: donorTypes[resource], ...Object.fromEntries(Object.entries(row).map(([key, value]) => [key,
        typeof value === 'boolean' ? String(value) : value != null && typeof value === 'object' ? JSON.stringify(value) : value,
    ])) },
})));
assert.equal(nativeDocuments.length, 2005);

async function check(withHost) {
    const window = new Window({
        url: 'https://shop-test.invalid/',
        settings: {
            enableJavaScriptEvaluation: true,
            disableJavaScriptFileLoading: true,
            disableCSSFileLoading: true,
            disableComputedStyleRendering: true,
        },
    });
    // Happy DOM omits the browser structuredClone global used for detached local draft values.
    window.structuredClone = structuredClone;
    // This no-layout DOM check exercises native forms, not attachment visibility.
    window.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} };
    const storageReads = { localStorage: 0, sessionStorage: 0 };
    let networkCalls = 0;
    const errors = [];
    window.console.error = (...values) => errors.push(values.map(value => String(value?.stack ?? value)).join(" "));
    const reads = [];
    const localDrafts = new Map();
    let draftRevision = 0;
    let presentation = {};
    const subscribers = new Map();
    for (const property of ['localStorage', 'sessionStorage']) {
        Object.defineProperty(window, property, { get() {
            storageReads[property]++;
            throw new window.DOMException('Opaque-origin sandbox storage denied.', 'SecurityError');
        } });
    }
    const denyNetwork = () => { networkCalls++; throw new Error('Unexpected network call in startup check'); };
    window.fetch = denyNetwork;
    window.XMLHttpRequest = class { constructor() { denyNetwork(); } };
    window.WebSocket = class { constructor() { denyNetwork(); } };
    window.EventSource = class { constructor() { denyNetwork(); } };
    window.navigator.sendBeacon = denyNetwork;
    window.addEventListener('error', event => errors.push(String(event.error ?? event.message)));
    window.addEventListener('unhandledrejection', event => errors.push(String(event.reason)));
    window.document.body.innerHTML = '<div id="root"></div>';
    if (withHost) {
        const room = { locator: 'local-test-room', name: 'Local startup fixture' };
        const host = createHouseBridgeTestHost({ address: '/app/local-startup-test' });
        const values = {
            rooms: [room], query: { documents: structuredClone(nativeDocuments) }, queue: [], 'room-drafts': [],
            'service-mode': 'open', 'storage-loss': null, 'connection-refusal': null,
            'sync-status': { state: 'synced', lastCompleted: '2026-10-11T13:00:00Z', providerUnreachable: false, attentionRequired: [], reset: null },
        };
        const client = {
            presentation: {read: async () => presentation, write: async value => {presentation = value;}},
            roomDraft: {
                read: async (_room, path) => localDrafts.get(path) ?? null,
                write: async (room, path, revision, parts) => {
                    const current = localDrafts.get(path);
                    if ((current?.revision ?? null) !== revision) return {outcome: 'stale', current: current ?? null};
                    const roomDraft = {room, path, revision: `draft-${++draftRevision}`, parts, changedUnderneath: {}, returned: null};
                    localDrafts.set(path, roomDraft); values['room-drafts'] = [...localDrafts.values()];
                    for (const listener of subscribers.get('room-drafts') ?? []) listener(values['room-drafts']);
                    return {outcome: 'written', roomDraft};
                },
            },
            save: async () => { throw new Error('Typing must not invoke Save'); },
            rooms: async () => [room],
            query: async () => { throw new Error('Navigation must use the observed local replica'); },
            observe: async (kind, query) => {
                if (kind === "query") reads.push(query);
                assert(Object.hasOwn(values, kind), `Unexpected observer ${kind}`);
                return { current: () => values[kind], subscribe: listener => { const held = subscribers.get(kind) ?? new Set(); held.add(listener); subscribers.set(kind, held); return () => held.delete(listener); }, close() {} };
            },
        };
        Object.defineProperty(window, 'houseBridge', { value: houseBridge(), configurable: true });
        host.attachRuntime(client);
    }
    try {
        const module = new vm.SourceTextModule(source, {
            context: window,
            identifier: filename,
            initializeImportMeta(meta) { meta.url = new URL(entry, window.location.href).href; },
            importModuleDynamically() { throw new Error('Unexpected lazy module during startup'); },
        });
        await module.link(specifier => { throw new Error(`Unexpected external import ${specifier}`); });
        await module.evaluate({ timeout: 5000 });
        const until = Date.now() + 5000;
        while (Date.now() < until) {
            const content = window.document.body.textContent;
            if (withHost ? content.includes('Monthly Revenue') && reads.length > 0 : content.includes('house_bridge_absent')) break;
            await new Promise(resolve => setTimeout(resolve, 20));
        }
        const content = window.document.body.textContent;
        assert.deepEqual(errors, [], `Uncaught startup errors: ${errors.join('; ')}`);
        assert.equal(networkCalls, 0, 'Startup must not make direct network calls');
        assert.equal(storageReads.localStorage, 0, 'Startup must not read localStorage');
        if (withHost) {
            assert(content.includes('Monthly Revenue'), `The donor dashboard must render: ${content.slice(-2000)}`);
            assert(reads.length > 0, 'The donor dashboard must observe its House replica');
            assert(reads.every(query => query.rooms?.length === 1 && query.rooms[0] === 'local-test-room'));
            assert.equal(reads.length, 1, 'Only one complete typed Room observation feeds every donor page');
            const products = [...window.document.querySelectorAll('a')].find(link => link.getAttribute('href')?.endsWith('/products'));
            assert(products, 'The real donor Products navigation is present');
            products.click();
            await new Promise(resolve => setTimeout(resolve, 100));
            assert(window.location.hash.includes('/products'));
            assert.equal(reads.length, 1, 'Client-side navigation does not start another Room read');
            assert(!window.document.body.textContent.includes('Loading data'), 'The mounted SPA stays ready during navigation');
            const findCreate = () => [...window.document.querySelectorAll('a')].find(link => link.getAttribute('href')?.endsWith('/products/create'));
            const listDeadline = Date.now() + 3000;
            while (Date.now() < listDeadline && !findCreate()) await new Promise(resolve => setTimeout(resolve, 20));
            assert(findCreate(), `The donor Create Product link is present: ${window.location.hash}; ${window.document.body.textContent.slice(-2400)}; ${errors.join('; ')}`);
            const findNativeProduct = () => [...window.document.querySelectorAll('a')].find(link => link.getAttribute('href')?.endsWith('/products/donor-126'));
            const nativeProduct = findNativeProduct();
            assert(nativeProduct, 'Aerial Coast appears in the real donor product list');
            nativeProduct.click();
            const editDeadline = Date.now() + 3000;
            while (Date.now() < editDeadline && !window.document.querySelector('input[name="reference"]')) await new Promise(resolve => setTimeout(resolve, 20));
            const nativeInput = window.document.querySelector('input[name="reference"]');
            assert(nativeInput, 'The exact native fields-all product opens in the donor editor');
            assert.equal(nativeInput.value, 'Aerial Coast');
            Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(nativeInput, 'Native product draft');
            nativeInput.dispatchEvent(new window.Event('input', {bubbles: true}));
            const nativeDeadline = Date.now() + 3000;
            while (Date.now() < nativeDeadline && !localDrafts.get('shop/products/donor-126.md')?.parts.fields?.reference) await new Promise(resolve => setTimeout(resolve, 20));
            const nativeParts = localDrafts.get('shop/products/donor-126.md')?.parts;
            assert.deepEqual(structuredClone(nativeParts?.fields?.reference), {value: 'Native product draft', base: {value: 'Aerial Coast'}}, `Native edit preserves its exact field base: ${window.document.body.textContent.slice(-2400)}`);
            assert(!Object.hasOwn(nativeParts.fields, 'type'), 'Native type is not an editable field');
            [...window.document.querySelectorAll('a')].find(link => link.getAttribute('href')?.endsWith('/products')).click();
            const reopenDeadline = Date.now() + 3000;
            while (Date.now() < reopenDeadline && !findNativeProduct()) await new Promise(resolve => setTimeout(resolve, 20));
            findNativeProduct().click();
            const restoredDeadline = Date.now() + 3000;
            while (Date.now() < restoredDeadline && window.document.querySelector('input[name="reference"]')?.value !== 'Native product draft') await new Promise(resolve => setTimeout(resolve, 20));
            assert.equal(window.document.querySelector('input[name="reference"]')?.value, 'Native product draft', 'Reopening recovers the native field draft');
            [...window.document.querySelectorAll('a')].find(link => link.getAttribute('href')?.endsWith('/products')).click();
            const createDeadline = Date.now() + 3000;
            while (Date.now() < createDeadline && !findCreate()) await new Promise(resolve => setTimeout(resolve, 20));
            findCreate().click();
            const formDeadline = Date.now() + 3000;
            while (Date.now() < formDeadline && !window.document.querySelector('[role="tab"]')) await new Promise(resolve => setTimeout(resolve, 20));
            assert.equal(window.document.querySelectorAll('[role="tab"]').length, 3, `Draft lifecycle must preserve three tabs: ${window.location.hash}; ${window.document.body.textContent.slice(-2400)}; ${errors.join('; ')}`);
            const reference = window.document.querySelector('input[name="reference"]');
            assert(reference, 'The eager donor product details form is mounted');
            Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(reference, 'Local product draft');
            reference.dispatchEvent(new window.Event('input', {bubbles: true}));
            const deadline = Date.now() + 3000;
            while (Date.now() < deadline && ![...localDrafts.values()].some(draft => draft.parts.creation?.fields?.reference === 'Local product draft')) await new Promise(resolve => setTimeout(resolve, 20));
            assert([...localDrafts.values()].some(draft => draft.parts.creation?.fields?.reference === 'Local product draft'), 'Typing stages the actual product field locally');
            assert.equal(reads.length, 1, 'Form navigation does not query outside the observed local snapshot');
            assert.equal(networkCalls, 0, 'Form typing must stay local');
            assert.deepEqual(errors, [], 'The actual donor form must mount without uncaught errors');
        } else {
            assert(content.includes('house_bridge_absent'), 'Missing host must reach the existing connection error UI');
            assert(content.includes('Retry connection'));
        }
        return { host: withHost, storageReads, networkCalls, uncaughtErrors: errors, houseReads: reads.length };
    } finally {
        await window.happyDOM.close();
    }
}
console.log(JSON.stringify({ entry, checks: [await check(false), await check(true)] }, null, 2));
