#!/usr/bin/env node
// Read-only planning. No schema edit, Room edit, upload, or publication is performed.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { setTimeout } from 'node:timers/promises';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { parse } from '@agentshouse/mdmodel';
import { seedRecords } from './donor-seed-data.mjs';
export function imageTargets() {
    return Object.entries(seedRecords).flatMap(([resource, rows]) => rows.flatMap(row => {
        const fields = Object.fromEntries(['image', 'thumbnail', 'avatar'].filter(field => /^at_[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(row[field] ?? '')).map(field => [field, row[field]]));
        return Object.keys(fields).length ? [{ path: `/rooms/shop-port/shop/${resource}/${row.id}.md`, type: `shop_${resource === 'categories' ? 'category' : resource.slice(0, -1)}`, id: row.id, fields }] : [];
    }));
}
export function planFields(target, markdown) {
    const result = parse(markdown);
    assert(result.ok, `Cannot parse ${target.path}`);
    const document = result.document;
    assert.equal(document.type, target.type, `Wrong type at ${target.path}`);
    assert.equal(document.fields.id, target.id, `Wrong ID at ${target.path}`);
    return Object.entries(target.fields).flatMap(([field, value]) => {
        const old = document.fields[field];
        // Never replace somebody's deliberately selected artwork or newer attachment.
        assert(old === undefined || old === '' || old === value, `Changed ${field} at ${target.path}; review before planning`);
        return old === value ? [] : [{ op: 'set_field', path: target.path, field, ...(old === undefined ? {} : { base: old }), value }];
    });
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const args = process.argv.slice(2);
    assert(args.length === 2 && args[0] === '--output', 'Usage: node scripts/plan-donor-images.mjs --output /path/plan.json');
    const targets = imageTargets();
    const changes = [];
    const reads = [];
    // Bound reads below the House shell output limit; exact field values are bases.
    for (let index = 0; index < targets.length; index += 12) {
        const batch = targets.slice(index, index + 12);
        const read = () => execFileSync('house', ['shell', JSON.stringify({ command: 'cat ' + batch.map(target => target.path).join(' ') })], { encoding: 'utf8', maxBuffer: 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
        let output;
        try { output = read(); }
        catch (error) {
            // A read-only retry is allowed only for the service's explicit transient response.
            if (!String(error.stderr).includes('auth_unavailable: House cannot check access right now')) throw error;
            await setTimeout(5000);
            output = read();
        }
        assert(!output.includes('output_cut'), 'Truncated House read; do not continue');
        const documents = output.split(/(?=^---\ntype:)/m).filter(text => text.trim());
        assert.equal(documents.length, batch.length, 'Unexpected document count in Room read');
        for (const [offset, target] of batch.entries()) {
            changes.push(...planFields(target, documents[offset]));
            reads.push({ path: target.path, sha256: createHash('sha256').update(documents[offset]).digest('hex') });
        }
    }
    const plan = { preparedAt: new Date().toISOString(), room: 'r_19.z', status: 'planned-only', activationGate: 'Do not apply until the compatible published reader is actually activated and the optional avatar/image Room schema is accepted.', targetDocuments: targets.length, imageFieldChanges: changes.length, source: JSON.parse(readFileSync(new URL('./donor-demo/provenance.json', import.meta.url))), reads, changes };
    writeFileSync(args[1], JSON.stringify(plan, null, 2) + '\n');
    console.log(JSON.stringify({ output: args[1], targetDocuments: targets.length, imageFieldChanges: changes.length, status: plan.status }));
}
