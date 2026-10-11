// @vitest-environment node
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { expect, it } from 'vitest';
it.each(['ProductCreate', 'ProductEdit'])('%s uses the shared attachment-preserving image input', name => {
  const text = readFileSync(new URL(`../src/products/${name}.tsx`, import.meta.url), 'utf8');
  const source = ts.createSourceFile(name + '.tsx', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const inputs: ts.JsxSelfClosingElement[] = [];
  function visit(node: ts.Node) {
    if (ts.isJsxSelfClosingElement(node) && node.tagName.getText(source) === 'ProductImageInput') inputs.push(node);
    ts.forEachChild(node, visit);
  }
  visit(source);
  expect(inputs).toHaveLength(2);
  expect(inputs.map(input => input.attributes.properties.find(prop => ts.isJsxAttribute(prop) && prop.name.getText(source) === 'source')?.getText(source))).toEqual(['source="image"', 'source="thumbnail"']);
});
it('keeps the opened Room image selectable and allows an explicit empty image', () => {
  const text = readFileSync(new URL('../src/products/ProductImageInput.tsx', import.meta.url), 'utf8');
  expect(text).toContain('isAttachmentReference(current)');
  expect(text).toContain("{ id: current, name: 'Current Room image' }");
  expect(text).toContain('emptyValue=""');
  expect(text).toContain('useWatch({name: source})');
  expect(text).toContain('isAttachmentReference(draftValue)');
  expect(text).toContain('choices={draftChoices}');
  expect(text).not.toContain('required(');
});
