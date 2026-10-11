#!/usr/bin/env node
// Legacy hand-authored regression fixtures; not for new Room population.
// Use donor-seed-data.mjs for the complete licensed donor demo instead.
// Prints a changeset only; never sends it.
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
const stamp = (day) => `2026-10-${String(day).padStart(2, "0")}T10:00:00.000Z`;
const money = (value) => Math.round(value * 100) / 100;
const categories = ["Geometric", "Landscapes", "Botanical", "Abstract"].map(
  (name, i) => ({ id: `category-${i + 1}`, name }),
);
const names = [
  "Amber Arches",
  "Blue Horizon",
  "Quiet Fern",
  "Coral Circles",
  "Golden Dunes",
  "Willow Study",
  "Tidal Forms",
  "Evening Hills",
  "Olive Branch",
  "Mosaic Rhythm",
  "Coastal Dawn",
  "Garden Lines",
];
const products = names.map((reference, i) => ({
  id: `product-${i + 1}`,
  category_id: categories[i % 4].id,
  reference,
  width: 30 + (i % 2) * 20,
  height: 40 + (i % 2) * 30,
  price: 18 + i * 3.5,
  stock: i === 3 ? 2 : 12 + i * 3,
  sales: i * 2,
  description: `<p>${reference} is an original synthetic print study. Printed on matte archival paper.</p>`,
  image: `/posters/${String(i + 1).padStart(2, "0")}.svg`,
  thumbnail: `/posters/${String(i + 1).padStart(2, "0")}.svg`,
}));
const people = [
  ["Ada", "Rowan"],
  ["Milo", "Brooks"],
  ["Nora", "Vale"],
  ["Owen", "Reed"],
  ["Lina", "Stone"],
  ["Theo", "Park"],
  ["Iris", "Lake"],
  ["Eli", "Wood"],
  ["Sora", "Hill"],
  ["Noah", "Frost"],
  ["Maya", "Wells"],
  ["Leon", "Ash"],
  ["Rosa", "Finch"],
  ["Arlo", "Fields"],
  ["Emma", "Birch"],
  ["Leo", "Sands"],
];
const customers = people.map(([first_name, last_name], i) => ({
  id: `customer-${i + 1}`,
  first_name,
  last_name,
  email: `${first_name.toLowerCase()}.${last_name.toLowerCase()}@customer.example`,
  address: `${10 + i} Example Lane`,
  zipcode: `970${String(i + 1).padStart(2, "0")}`,
  city: ["Portland", "Seattle", "Austin", "Denver"][i % 4],
  stateAbbr: ["OR", "WA", "TX", "CO"][i % 4],
  first_seen: stamp(1 + (i % 5)),
  last_seen: stamp(5 + (i % 6)),
  has_newsletter: i % 3 === 0,
  has_ordered: i < 12,
  groups: i % 4 === 0 ? ["collector"] : i % 4 === 1 ? ["compulsive"] : [],
  nb_orders: 0,
  total_spent: 0,
}));
const orders = Array.from({ length: 18 }, (_, i) => {
  const product = products[i % 12];
  const product2 = products[(i + 4) % 12];
  const basket =
    i % 3 === 0
      ? [
          { product_id: product.id, quantity: 1 },
          { product_id: product2.id, quantity: 2 },
        ]
      : [{ product_id: product.id, quantity: 1 + (i % 2) }];
  const total_ex_taxes = money(
    basket.reduce(
      (n, item) =>
        n +
        products.find((p) => p.id === item.product_id).price * item.quantity,
      0,
    ),
  );
  const delivery_fees = 4.5;
  const tax_rate = 0.1;
  const taxes = money((total_ex_taxes + delivery_fees) * tax_rate);
  return {
    id: `order-${i + 1}`,
    reference: `ORD-2026-${String(i + 1).padStart(4, "0")}`,
    date: stamp(1 + (i % 10)),
    customer_id: customers[i % 12].id,
    basket,
    total_ex_taxes,
    delivery_fees,
    tax_rate,
    taxes,
    total: money(total_ex_taxes + delivery_fees + taxes),
    status: i % 6 === 0 ? "cancelled" : i % 3 === 0 ? "ordered" : "delivered",
    returned: i === 5,
  };
});
for (const customer of customers) {
  const own = orders.filter(
    (o) => o.customer_id === customer.id && o.status !== "cancelled",
  );
  customer.nb_orders = own.length;
  customer.has_ordered = own.length > 0;
  customer.total_spent = money(own.reduce((n, o) => n + o.total, 0));
  if (own.length)
    customer.latest_purchase = own
      .map((o) => o.date)
      .sort()
      .at(-1);
}
const invoices = orders
  .filter((o) => o.status === "delivered")
  .slice(0, 10)
  .map((order, i) => ({
    id: `invoice-${i + 1}`,
    date: order.date,
    order_id: order.id,
    customer_id: order.customer_id,
    ...Object.fromEntries(
      ["total_ex_taxes", "delivery_fees", "tax_rate", "taxes", "total"].map(
        (k) => [k, order[k]],
      ),
    ),
  }));
const comments = [
  "The colors are lovely and the paper feels substantial.",
  "Fits perfectly above the reading chair.",
  "Carefully packaged and a clear, detailed print.",
  "A calm addition to our living room.",
];
const reviews = orders
  .filter((o) => o.status !== "cancelled")
  .slice(0, 12)
  .map((order, i) => ({
    id: `review-${i + 1}`,
    date: stamp(6 + (i % 5)),
    status: ["accepted", "pending", "rejected"][i % 3],
    order_id: order.id,
    product_id: order.basket[0].product_id,
    customer_id: order.customer_id,
    rating: 3 + (i % 3),
    comment: comments[i % 4],
  }));
export const seedRecords = {
  categories,
  products,
  customers,
  orders,
  invoices,
  reviews,
};
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
  return `---\n${front}\n---\n\n# ${title}\n\nSynthetic demonstration record. All people, contact details and transactions are fictional.\n`;
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
    throw new Error("Usage: node scripts/seed-data.mjs [--room slug]");
  process.stdout.write(
    JSON.stringify(buildSeedChanges(args[1]), null, 2) + "\n",
  );
}
