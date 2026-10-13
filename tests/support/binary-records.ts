import { readFileSync } from 'node:fs';
const original = JSON.parse(readFileSync(new URL('./donor-demo/records.json', import.meta.url), 'utf8'));
const images = JSON.parse(readFileSync(new URL('./donor-demo/poster-attachments.json', import.meta.url), 'utf8')).attachments;
const paths = Object.fromEntries(Object.entries(images).map(([name, reference]) => [String(reference), `images/${name}`]));
export const binaryRecords = Object.fromEntries(Object.entries(original).map(([resource, rows]) => [resource, (rows as Record<string, unknown>[]).map(row => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, ['image', 'thumbnail', 'avatar'].includes(key) && typeof value === 'string' ? paths[value] ?? value : value])))]));
