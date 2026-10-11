// @vitest-environment node
import { test, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { verify, validate } from "@agentshouse/mdmodel";
// @ts-expect-error Offline JavaScript fixture CLI.
import { seedRecords, buildSeedChanges } from "./support/donor-seed-data.mjs";
const hash = (value: string | Buffer) =>
  createHash("sha256").update(value).digest("hex");
test("full retail donor output preserves every entity and relationship", () => {
  const manifest = JSON.parse(
    readFileSync(
      new URL("./support/donor-demo/provenance.json", import.meta.url),
      "utf8",
    ),
  );
  expect(manifest.commit).toBe("f1213e048d60d83df74900b2fc8415fd3287610c");
  expect(manifest.counts).toEqual({
    categories: 13,
    products: 130,
    customers: 900,
    orders: 600,
    invoices: 77,
    reviews: 285,
  });
  expect(
    hash(
      readFileSync(
        new URL("./support/donor-demo/records.json", import.meta.url),
      ),
    ),
  ).toBe(manifest.outputSha256);
  expect(
    hash(
      readFileSync(
        new URL("./support/donor-demo/package-lock.json", import.meta.url),
      ),
    ),
  ).toBe(manifest.lockSha256);
  for (const [path, expected] of Object.entries(manifest.sources))
    expect(
      hash(
        readFileSync(
          new URL(`./support/donor-demo/upstream/${path}`, import.meta.url),
        ),
      ),
    ).toBe(expected);
  const ids = Object.fromEntries(
    Object.entries(seedRecords).map(([resource, rows]) => [
      resource,
      new Set((rows as any[]).map((row) => row.id)),
    ]),
  );
  for (const [resource, rows] of Object.entries(seedRecords))
    for (const row of rows as any[]) {
      expect(row.id).toMatch(/^donor-\d+$/);
      for (const [key, target] of Object.entries({
        category_id: "categories",
        customer_id: "customers",
        product_id: "products",
        order_id: "orders",
      }))
        if (row[key] != null)
          expect(
            ids[target].has(row[key]),
            `${resource}.${row.id}.${key}`,
          ).toBe(true);
      for (const item of row.basket ?? [])
        expect(ids.products.has(item.product_id)).toBe(true);
      for (const key of ["image", "thumbnail"])
        if (key in row) expect(row[key]).toMatch(/^at_[A-Za-z0-9][A-Za-z0-9_.-]*$/);
      if (row.avatar) expect(row.avatar).toMatch(/^at_[A-Za-z0-9][A-Za-z0-9_.-]*$/);
    }
  for (const invoice of seedRecords.invoices) {
    const order = seedRecords.orders.find(
      (row: any) => row.id === invoice.order_id,
    );
    expect(invoice.customer_id).toBe(order.customer_id);
    expect(invoice.total).toBe(order.total);
  }
  for (const review of seedRecords.reviews) {
    const order = seedRecords.orders.find(
      (row: any) => row.id === review.order_id,
    );
    expect(review.customer_id).toBe(order.customer_id);
    expect(
      order.basket.some((item: any) => item.product_id === review.product_id),
    ).toBe(true);
  }
  const { changes } = buildSeedChanges("shop-port");
  expect(changes).toHaveLength(2006);
  const result = verify(changes[0].content);
  expect(result.verdict).toBe("accept");
  if (result.verdict !== "accept") throw Error("schema refused");
  const library = Object.fromEntries(
    changes
      .slice(1)
      .map((change: any) => [
        change.path.replace("/rooms/shop-port/", ""),
        change.content,
      ]),
  );
  expect(validate(library, { binaryTargets: [] }, result.model)).toEqual({
    verdict: "accept",
  });
});
