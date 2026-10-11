import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { findReviewedFeature, reviewedTransforms, stripExternalFeature, type ReviewedTransform } from '../scripts/strip-external-features';

for (const kind of Object.keys(reviewedTransforms) as ReviewedTransform[]) {
    const review = reviewedTransforms[kind];
    const filename = path.resolve(import.meta.dirname, '..', review.file);
    const original = fs.readFileSync(filename, 'utf8');
    const parsed = ts.createSourceFile(filename, original, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    const target = findReviewedFeature(kind, parsed)[0];
    describe(`reviewed ${kind} removal`, () => {
        it('preserves all dependency source outside the exact reviewed feature', () => {
            const changed = stripExternalFeature(kind, original, filename, review.version);
            const prefix = original.slice(0, target.getStart(parsed));
            const suffix = original.slice(target.end);
            expect(changed.startsWith(prefix)).toBe(true);
            expect(changed.endsWith(suffix)).toBe(true);
            const replacement = changed.slice(prefix.length, changed.length - suffix.length);
            expect(replacement).not.toMatch(/window\.open|new Image|react-admin-telemetry/);
            if (kind === 'storageProbe') expect(replacement).toBe('() => false');
            else if (kind === 'telemetry') expect(replacement).toBe('useEffect(() => {}, [disableTelemetry])');
            else expect(replacement).toContain('throw new Error');
            if (kind === 'editorLink') {
                expect(replacement).toBe(target.getText(parsed).replace('window.open(href, target);',
                    'throw new Error("Shop Admin does not support external editor navigation.");'));
                expect(replacement).toContain('options.editor.commands.extendMarkRange');
            }
        });
        it('fails closed on dependency version drift', () => {
            expect(() => stripExternalFeature(kind, original, filename, '0.0.0')).toThrow(/version/);
        });
        it('fails closed on reviewed source drift', () => {
            const offset = target.getStart(parsed);
            const mutation = original.slice(0, offset) + target.getText(parsed).replace('{', '{ /* changed */') + original.slice(target.end);
            expect(() => stripExternalFeature(kind, mutation, filename, review.version)).toThrow(/source changed/);
        });
        it('fails closed on missing and duplicate features', () => {
            expect(() => stripExternalFeature(kind, '', filename, review.version)).toThrow(/exactly one/);
            const duplicate = kind === 'storageProbe' ? `const testLocalStorage = ${target.getText(parsed)};` : target.getText(parsed);
            expect(() => stripExternalFeature(kind, original + '\n' + duplicate, filename, review.version)).toThrow(/exactly one/);
        });
    });
}
