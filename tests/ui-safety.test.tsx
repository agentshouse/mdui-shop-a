import { describe, expect, it } from 'vitest';
import { posterChoices, safePoster, isAttachmentReference, initials } from '../src/assets';
import { sanitizeRichText } from '../src/safeRichText';
import { csvCell, exportRows } from '../src/safeExport';
import rowSx from '../src/reviews/rowSx';
import type { Review } from '../src/types';

describe('bundled artwork boundary', () => {
    it('maps all twelve logical IDs to local imported assets', () => {
        expect(posterChoices).toHaveLength(12);
        for (const choice of posterChoices) {
            expect(safePoster(choice.id)).not.toMatch(/^https?:\/\//);
            expect(safePoster(choice.id)).toMatch(/\.svg(?:\?|$)|^data:image\/svg\+xml/);
        }
    });
    it.each(['https://example.test/track.gif', '//example.test/a', 'javascript:alert(1)', 'data:image/svg+xml,<svg/>', '/posters/../secret', '/posters/01.svg?beacon=1', '__proto__', undefined, null])('rejects unrecognized image %s', value => {
        expect(safePoster(value)).toBe(safePoster(''));
        expect(safePoster(value)).not.toBe(safePoster('/posters/01.svg'));
    });
    it('does not substitute invented artwork for missing images', () => {
        const assets = posterChoices.map(choice => safePoster(choice.id));
        expect(assets).not.toContain(safePoster(''));
        expect(safePoster('')).toBeUndefined();
        expect(isAttachmentReference('images/animals-1.jpeg')).toBe(true);
        expect(isAttachmentReference('https://example.test/track')).toBe(false);
        expect(initials({ first_name: 'Ada', last_name: 'Stone' })).toBe('AS');
        expect(initials()).toBe('?');
    });
});

describe('formatting-only rich text', () => {
    it('retains useful headings, emphasis, lists and quotes', () => {
        const value = '<h2>About</h2><p>A <strong>bold</strong> and <em>lovely</em> print.</p><ul><li>Archival</li></ul><blockquote>Art</blockquote>';
        expect(sanitizeRichText(value)).toBe(value);
    });
    it('removes embedded resources, scripts and every attribute', () => {
        const dirty = '<style>p{background:url(https://example.test/a)}</style><p style="background:url(https://example.test/b)" onclick="alert(1)">Hello<img src="https://example.test/c"><svg><image href="https://example.test/d"/></svg><iframe src="https://example.test/e"></iframe><script>alert(1)</script><a href="https://example.test/f">link</a></p>';
        expect(sanitizeRichText(dirty)).toBe('<p>Hellolink</p>');
    });
    it('is idempotent and escapes literal text', () => {
        expect(sanitizeRichText('A &amp; B &lt; 3')).toBe('A &amp; B &lt; 3');
        const sanitized = sanitizeRichText('<div class="x"><b title="Y">a</b></div>');
        expect(sanitizeRichText(sanitized)).toBe(sanitized);
        expect(sanitizeRichText(undefined)).toBe('');
    });
});

describe('local CSV export', () => {
    it.each(['=HYPERLINK("bad")', '+1+2', '-1+2', '@SUM(A1)', '\t=1', '  =1'])('neutralizes spreadsheet formulas %s', value => {
        expect(csvCell(value)).toMatch(/^"'/);
    });
    it('escapes quotes and preserves ordinary numeric data', () => {
        expect(csvCell('a,"b"')).toBe('"a,""b"""');
        expect(csvCell(123.4)).toBe('"123.4"');
    });
    it('excludes Runtime metadata and undeclared fields', () => {
        const output = exportRows([{ id: 'p1', reference: 'Print', _house: { secret: 'internal' }, password: 'never' }], 'products');
        expect(output).toContain('Print');
        expect(output).not.toMatch(/_house|secret|internal|password|never/);
        expect(() => exportRows([], 'other')).toThrow('Unsupported export resource');
    });
});

it('highlights a review selected by a string route ID', () => {
    const record = { id: 12, status: 'pending' } as Review;
    expect(rowSx('12')(record)).toMatchObject({ backgroundColor: 'action.selected' });
});
