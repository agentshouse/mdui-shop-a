import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { expect, it } from 'vitest';

it('aligns every installed react-admin router consumer on reviewed 7.18.2', () => {
    const root = path.resolve(import.meta.dirname, '..');
    const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
    for (const name of ['react-router', 'react-router-dom']) {
        expect(lock.packages[''].dependencies[name]).toBe('7.18.2');
        expect(JSON.parse(fs.readFileSync(path.join(root, 'node_modules', name, 'package.json'), 'utf8')).version).toBe('7.18.2');
    }
    for (const [name, entry] of Object.entries(lock.packages) as [string, { version: string }][]) {
        if (/node_modules\/react-router(?:-dom)?$/.test(name)) expect(entry.version).toBe('7.18.2');
    }
    for (const consumer of ['react-admin', 'ra-core', 'ra-ui-materialui', 'react-router-dom']) {
        const fromConsumer = createRequire(path.join(root, 'node_modules', consumer, 'package.json'));
        expect(fromConsumer('react-router/package.json').version).toBe('7.18.2');
        if (consumer !== 'react-router-dom') expect(fromConsumer('react-router-dom/package.json').version).toBe('7.18.2');
    }
});
