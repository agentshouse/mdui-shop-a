import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import type { Plugin } from 'vite';

export const reviewedTransforms = {
    storageProbe: {
        package: 'ra-core', version: '5.15.4',
        file: 'node_modules/ra-core/dist/store/localStorageStore.js',
        sha256: 'd1f727358833000983ccab3f3d33640000205c4b674fa2bc12a947c03b4d9cbc',
    },
    telemetry: {
        package: 'ra-core', version: '5.15.4',
        file: 'node_modules/ra-core/dist/core/CoreAdminUI.js',
        sha256: 'c269c8689effae443856d94656c02a13c92c0e09f73b54dfa4c37757d32fc518',
    },
    editorLink: {
        package: '@tiptap/extension-link', version: '3.31.4',
        file: 'node_modules/@tiptap/extension-link/dist/index.js',
        sha256: '00b813216a873590e0fd0a2c40de1218fa9978b3e301184b831521a4248e8c33',
    },
    chartLink: {
        package: 'echarts', version: '6.1.0',
        file: 'node_modules/echarts/lib/util/format.js',
        sha256: '7d421cb1cf686015f64468ee8a8531de31538725e780a8fd468eb538375af069',
    },
} as const;
export type ReviewedTransform = keyof typeof reviewedTransforms;

export function findReviewedFeature(kind: ReviewedTransform, parsed: ts.SourceFile): ts.Node[] {
    const matches: ts.Node[] = [];
    function visit(node: ts.Node) {
        if (kind === 'storageProbe' && ts.isVariableDeclaration(node)
            && node.name.getText(parsed) === 'testLocalStorage' && node.initializer) matches.push(node.initializer);
        if (kind === 'telemetry' && ts.isCallExpression(node)
            && node.expression.getText(parsed) === 'useEffect'
            && node.getText(parsed).includes('react-admin-telemetry.marmelab.com')) matches.push(node);
        if (kind === 'editorLink' && ts.isFunctionDeclaration(node) && node.name?.text === 'clickHandler') matches.push(node);
        if (kind === 'chartLink' && ts.isFunctionDeclaration(node) && node.name?.text === 'windowOpen') matches.push(node);
        ts.forEachChild(node, visit);
    }
    visit(parsed);
    return matches;
}

/** Retain all source outside the exact reviewed optional dependency feature. */
export function stripExternalFeature(kind: ReviewedTransform, code: string, filename: string, version: string): string {
    const review = reviewedTransforms[kind];
    assert.equal(version, review.version, `Review ${review.package} version before building Shop Admin`);
    const parsed = ts.createSourceFile(filename, code, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const matches = findReviewedFeature(kind, parsed);
    assert.equal(matches.length, 1, `Expected exactly one reviewed ${kind} feature`);
    const node = matches[0];
    const original = node.getText(parsed);
    assert.equal(createHash('sha256').update(original).digest('hex'), review.sha256,
        `${review.package} ${kind} source changed; inspect before building`);
    let replacement: string;
    if (kind === 'storageProbe') {
        // Admin imports this probe eagerly, even with our explicit memoryStore.
        // Opaque-origin House frames cannot read the browser storage property.
        // Keep this unused default store memory-only; House owns all records.
        replacement = '() => false';
    } else if (kind === 'telemetry') {
        // Preserve the hook position and dependency array, without creating an Image.
        replacement = 'useEffect(() => {}, [disableTelemetry])';
    } else if (kind === 'chartLink') {
        replacement = 'export function windowOpen() { throw new Error("Shop Admin does not support external chart navigation."); }';
    } else {
        // Keep editor click-selection behavior exactly; replace only outside opening.
        assert.equal(original.split('window.open(href, target);').length, 2);
        replacement = original.replace('window.open(href, target);',
            'throw new Error("Shop Admin does not support external editor navigation.");');
    }
    return code.slice(0, node.getStart(parsed)) + replacement + code.slice(node.end);
}

export function stripUnusedExternalFeatures(): Plugin {
    const root = path.resolve(import.meta.dirname, '..');
    const counts = new Map<ReviewedTransform, number>();
    const versions = new Map<ReviewedTransform, string>();
    const kinds = Object.keys(reviewedTransforms) as ReviewedTransform[];
    return {
        name: 'shop-strip-reviewed-external-features', apply: 'build', enforce: 'pre',
        buildStart() {
            counts.clear(); versions.clear();
            for (const kind of kinds) {
                const review = reviewedTransforms[kind];
                const version = JSON.parse(fs.readFileSync(path.join(root, 'node_modules', review.package, 'package.json'), 'utf8')).version;
                assert.equal(version, review.version, `Review ${review.package} version before building Shop Admin`);
                versions.set(kind, version);
            }
        },
        transform(code, id) {
            const normalized = id.split('?')[0];
            const kind = kinds.find(key => normalized === path.join(root, reviewedTransforms[key].file));
            if (!kind) return null;
            const count = (counts.get(kind) ?? 0) + 1;
            counts.set(kind, count);
            assert.equal(count, 1, `${kind} appeared in more than one transformed module`);
            return { code: stripExternalFeature(kind, code, id, versions.get(kind)!), map: null };
        },
        buildEnd(error) {
            if (!error) for (const kind of kinds) assert.equal(counts.get(kind), 1, `Reviewed ${kind} feature was not transformed`);
        },
    };
}
