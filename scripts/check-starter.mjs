import { checkCurrentStarter } from './check-current-starter.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { verify, validate, parse } from '@agentshouse/mdmodel';

assert(fs.existsSync('starter'), 'Missing text-only Template starter.');
const library = {};
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    assert(!entry.isSymbolicLink(), `Starter symlink is not portable: ${file}`);
    if (entry.isDirectory()) walk(file);
    else {
      assert(file.endsWith('.md'), `Undocumented starter binary packaging: ${file}`);
      library[file.slice('starter/'.length)] = fs.readFileSync(file, 'utf8');
    }
  }
}
walk('starter');
assert(Object.keys(library).length > 0, 'Starter must contain current documents.');
const schema = verify(fs.readFileSync('schema.yaml', 'utf8'));
assert.equal(schema.verdict, 'accept');
assert.deepEqual(validate(library, { binaryTargets: [] }, schema.model), { verdict: 'accept' });
checkCurrentStarter(library);
const resources = { shop_product: 'products', shop_category: 'categories', shop_customer: 'customers', shop_order: 'orders', shop_invoice: 'invoices', shop_review: 'reviews' };
const documents = Object.entries(library).map(([filename, content]) => {
  const result = parse(content);
  assert(result.ok);
  const resource = resources[result.document.type];
  assert(resource, `Unknown Starter resource: ${filename}`);
  assert.equal(filename, `shop/${resource}/${result.document.fields.id}.md`);
  // Room-specific attachment IDs are unusable in a newly instantiated Room.
  assert(!Object.values(result.document.fields).some(value => typeof value === 'string' && /^at_/.test(value)), 'Unresolved Room-scoped attachment in starter; establish the portable attachment contract before publication.');
  return result.document;
});
for (const type of ['shop_product', 'shop_category', 'shop_customer']) assert(documents.some(document => document.type === type), `Starter lacks ${type}.`);
const targets = { category_id: 'shop_category', product_id: 'shop_product', customer_id: 'shop_customer', order_id: 'shop_order' };
for (const document of documents) {
  for (const [field, type] of Object.entries(targets)) if (document.fields[field] != null) assert(documents.some(target => target.type === type && target.fields.id === document.fields[field]), `Dangling starter reference: ${field}`);
  if (document.fields.basket) for (const item of JSON.parse(document.fields.basket)) assert(documents.some(target => target.type === 'shop_product' && target.fields.id === item.product_id), 'Dangling basket product.');
}
console.log(`Validated ${documents.length} portable starter documents.`);
