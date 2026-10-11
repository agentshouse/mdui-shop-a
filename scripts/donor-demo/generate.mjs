// Offline deterministic reproduction of the unchanged React Admin retail demo.
import { build } from "esbuild";
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, relative } from "node:path";
import { createHash } from "node:crypto";
const root = fileURLToPath(new URL(".", import.meta.url));
const require = createRequire(import.meta.url);
const referenceDate = "2026-10-11T12:00:00.000Z";
const seed = 1150;
const RealDate = Date;
globalThis.Date = class extends RealDate {
  constructor(...args) {
    super(...(args.length ? args : [referenceDate]));
  }
  static now() {
    return RealDate.parse(referenceDate);
  }
};
const { faker } = require("@faker-js/faker");
faker.seed(seed);
faker.setDefaultRefDate(referenceDate);
const result = await build({
  entryPoints: [join(root, "upstream/examples/data-generator/src/index.ts")],
  bundle: true,
  platform: "node",
  format: "cjs",
  write: false,
  packages: "external",
});
const module = { exports: {} };
new Function("require", "module", "exports", result.outputFiles[0].text)(
  require,
  module,
  module.exports,
);
const donor = module.exports.default();
const posterManifest = JSON.parse(readFileSync(join(root, 'poster-attachments.json'), 'utf8'));
function roomImage(url) {
  const filename = url.split('/').pop();
  const reference = posterManifest.attachments[filename];
  if (!reference || !/^at_[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(reference)) throw new Error(`Missing Room image for ${filename}`);
  return reference;
}

globalThis.Date = RealDate;
// Retain all supported entity records. The donor settings are server/email configuration,
// not a resource in the Shop App and are deliberately not copied.
const resources = [
  "categories",
  "products",
  "customers",
  "orders",
  "invoices",
  "reviews",
];
const records = Object.fromEntries(
  resources.map((resource) => [
    resource,
    donor[resource].map((row) =>
      Object.fromEntries(
        Object.entries(row)
          .filter(([_key, value]) => value != null)
          .map(([key, value]) => {
            if (
              [
                "id",
                "category_id",
                "customer_id",
                "product_id",
                "order_id",
              ].includes(key)
            )
              return [key, `donor-${value}`];
            if (key === "basket")
              return [
                key,
                value.map((item) => ({
                  ...item,
                  product_id: `donor-${item.product_id}`,
                })),
              ];
            if (["image", "thumbnail", "avatar"].includes(key)) return [key, roomImage(value)];
            return [
              key,
              typeof value === "string" ? value.replace(/\r/g, "") : value,
            ];
          }),
      ),
    ),
  ]),
);
for (const category of records.categories) category.image = roomImage(`${category.name}-1.jpeg`);
const output = JSON.stringify(records, null, 2) + "\n";
writeFileSync(join(root, "records.json"), output);
const files = [];
function walk(dir) {
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, item.name);
    if (item.isDirectory()) walk(p);
    else files.push(p);
  }
}
walk(join(root, "upstream"));
const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const manifest = {
  repository: "https://github.com/marmelab/react-admin",
  commit: "f1213e048d60d83df74900b2fc8415fd3287610c",
  license: "MIT",
  seed,
  referenceDate,
  timezone: "UTC",
  dependencies: {
    "@faker-js/faker": "10.6.0",
    "date-fns": "3.6.0",
    esbuild: "0.27.4",
  },
  counts: Object.fromEntries(
    Object.entries(records).map(([k, v]) => [k, v.length]),
  ),
  outputSha256: sha256(output),
  posterAttachmentsSha256: sha256(readFileSync(join(root, "poster-attachments.json"))),
  posters: { repository: posterManifest.repository, commit: posterManifest.commit, room: posterManifest.room, source: posterManifest.source },
  lockSha256: sha256(readFileSync(join(root, "package-lock.json"))),
  sources: Object.fromEntries(
    files
      .sort()
      .map((p) => [
        relative(join(root, "upstream"), p),
        sha256(readFileSync(p)),
      ]),
  ),
};
writeFileSync(
  join(root, "provenance.json"),
  JSON.stringify(manifest, null, 2) + "\n",
);
process.stdout.write(
  JSON.stringify({ counts: manifest.counts, sha256: manifest.outputSha256 }) +
    "\n",
);
