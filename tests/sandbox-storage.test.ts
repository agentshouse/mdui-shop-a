import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';
import { reviewedTransforms, stripExternalFeature } from '../scripts/strip-external-features';

const review = reviewedTransforms.storageProbe;
const filename = path.resolve(import.meta.dirname, '..', review.file);
const original = fs.readFileSync(filename, 'utf8');
const adapted = stripExternalFeature('storageProbe', original, filename, review.version);

type StoreModule = Pick<typeof import('ra-core'), 'localStorageStore'>;
function evaluateModule(source: string, window: object): StoreModule {
    // This dependency is self-contained. Execute the entire actual installed
    // module after the exact build adaptation, not a reimplementation of it.
    const code = ts.transpileModule(source, {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText;
    const context = { window, exports: {} };
    vm.runInNewContext(code, context, { filename, timeout: 1000 });
    return context.exports as StoreModule;
}

function sandboxWindow() {
    const readStorage = vi.fn(() => {
        throw new DOMException('The document is sandboxed and lacks the allow-same-origin flag.', 'SecurityError');
    });
    const window = Object.defineProperties({}, {
        localStorage: { get: readStorage },
        sessionStorage: { get: readStorage },
    });
    return { window, readStorage };
}

describe('opaque-origin sandbox startup', () => {
    it('reproduces the upstream import-time SecurityError before the fix', () => {
        const { window, readStorage } = sandboxWindow();
        expect(() => evaluateModule(original, window)).toThrow(/sandboxed/);
        expect(readStorage).toHaveBeenCalledTimes(1);
    });

    it('imports and uses the default preference store without reading blocked storage', () => {
        const { window, readStorage } = sandboxWindow();
        const { localStorageStore } = evaluateModule(adapted, window);
        const store = localStorageStore();
        const changed = vi.fn();
        expect(() => store.setup()).not.toThrow();
        const unsubscribe = store.subscribe('themeName', changed);
        expect(store.getItem('themeName', 'soft')).toBe('soft');
        store.setItem('themeName', 'dark');
        expect(store.getItem('themeName')).toBe('dark');
        expect(changed).toHaveBeenLastCalledWith('dark');
        store.removeItem('themeName');
        expect(store.getItem('themeName', 'soft')).toBe('soft');
        unsubscribe();
        store.teardown();
        expect(readStorage).not.toHaveBeenCalled();
    });

    it('does not persist UI preferences even when browser storage would be available', () => {
        const storage = { getItem: vi.fn(), setItem: vi.fn(), removeItem: vi.fn() };
        const readStorage = vi.fn(() => storage);
        const window = Object.defineProperty({}, 'localStorage', { get: readStorage });
        const first = evaluateModule(adapted, window).localStorageStore();
        first.setup();
        first.setItem('themeName', 'dark');
        expect(first.getItem('themeName')).toBe('dark');
        const nextLoad = evaluateModule(adapted, window).localStorageStore();
        expect(nextLoad.getItem('themeName', 'soft')).toBe('soft');
        expect(readStorage).not.toHaveBeenCalled();
        expect(storage.setItem).not.toHaveBeenCalled();
    });
});
