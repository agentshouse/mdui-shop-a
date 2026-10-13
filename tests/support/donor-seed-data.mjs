#!/usr/bin/env node
// Full pinned donor dataset. Offline only; never imported by the production App.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
const types = {
  categories: "shop_category",
  products: "shop_product",
  customers: "shop_customer",
  orders: "shop_order",
  invoices: "shop_invoice",
  reviews: "shop_review",
};
const retainedRecords = JSON.parse(
  readFileSync(new URL("./donor-demo/records.json", import.meta.url), "utf8"),
);
const attachmentMap = JSON.parse(readFileSync(new URL("./donor-demo/poster-attachments.json", import.meta.url), "utf8")).attachments;
const filePaths = Object.fromEntries(Object.entries(attachmentMap).map(([name, reference]) => [reference, `images/${name}`]));
export const seedRecords = Object.fromEntries(Object.entries(retainedRecords).map(([resource, rows]) => [resource, rows.map(row => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, ["image", "thumbnail", "avatar"].includes(key) && typeof value === "string" ? filePaths[value] ?? value : value])))]));
export function serializeSeedRecord(resource, record) {
  const fields = { type: types[resource], ...record };
  const front = Object.entries(fields)
    .filter(([, v]) => v != null)
    .map(
      ([key, value]) =>
        `${key}: ${JSON.stringify(typeof value === "boolean" ? String(value) : typeof value === "object" ? JSON.stringify(value) : value)}`,
    )
    .join("\n");
  const title =
    record.reference ??
    record.name ??
    ([record.first_name, record.last_name].filter(Boolean).join(" ") ||
      record.id);
  return `---\n${front}\n---\n\n# ${title}\n\nDonor demo record reused from React Admin retail data-generator (MIT), commit f1213e048d60d83df74900b2fc8415fd3287610c. Generated with faker 10.6.0, seed 1150, reference date 2026-10-11T12:00:00.000Z. Fictional demonstration only.\n`;
}
export function buildSeedChanges(room = "shop-port") {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(room))
    throw new Error("Room must be a lowercase hyphen-separated slug.");
  return {
    changes: [
      {
        op: "create",
        path: `/rooms/${room}/settings/schema.yaml`,
        content: readFileSync(
          new URL("../../schema.yaml", import.meta.url),
          "utf8",
        ),
      },
      ...Object.entries(seedRecords).flatMap(([resource, records]) =>
        records.map((record) => ({
          op: "create",
          path: `/rooms/${room}/shop/${resource}/${record.id}.md`,
          content: serializeSeedRecord(resource, record),
        })),
      ),
    ],
  };
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 2 || args[0] !== "--room"))
    throw new Error("Usage: node scripts/donor-seed-data.mjs [--room slug]");
  process.stdout.write(
    JSON.stringify(buildSeedChanges(args[1]), null, 2) + "\n",
  );
}
