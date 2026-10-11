import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

export const root = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
export const donorCommit = "f1213e048d60d83df74900b2fc8415fd3287610c";
const donorLicenseHash =
  "7e911f566da7d1fb2ecaac204de5587538339902ebdceaac5e1f845c48c1981d";
const separator = "\n" + "=".repeat(80) + "\n";
const supplementalLicenses = [
  {
    names: ["@cfworker/json-schema"],
    version: "4.1.1",
    file: "licenses/cfworker-json-schema-MIT.txt",
    source:
      "https://github.com/cfworker/cfworker/blob/5409fdc2bd144f68e8b28c61c71fcb16600000a6/LICENSE.md",
    sha256: "376944252ab78ca6b41aee44ddea8894927ee67891e77e61eb9d59af63e35094",
    provenance:
      "Original upstream license from the package publication commit.",
  },

];

// Keep published license identifiers and full distributed notices intact. Do not
// infer a license grant from the application's or another package's MIT license.
export function collectNotices() {
  const lock = JSON.parse(
    fs.readFileSync(path.join(root, "package-lock.json"), "utf8"),
  );
  const donorLicense = fs.readFileSync(path.join(root, "LICENSE.md"), "utf8");
  assert.equal(
    createHash("sha256").update(donorLicense).digest("hex"),
    donorLicenseHash,
    "Pinned donor MIT notice changed",
  );
  const parts = [
    "THIRD-PARTY NOTICES\n\nShop Admin includes modified software and assets from marmelab/react-admin,\n" +
      `examples/demo at commit ${donorCommit}. The donor MIT\n` +
      "notice is retained below. Locally installed fonts carry their own notices.\n\n" +
      "The dependency notices cover the installed production dependency closure\n" +
      "in package-lock.json, a superset of packages actually bundled. Development\n" +
      "build/test tools are not shipped and are not included. Published license\n" +
      "identifiers and full distributed notices are retained without inventing\n" +
      "missing permission.\n\n" +
      "Each package's published license grant is retained below.\n",
    separator +
      "Donor: marmelab/react-admin examples/demo\n" +
      `Source: https://github.com/marmelab/react-admin/tree/${donorCommit}/examples/demo\n` +
      `Commit: ${donorCommit}\nLicense identifier: MIT\n\n` +
      donorLicense,
  ];
  const packages = [];
  const missingLicenseFiles = [];
  const supplementalLicenseFiles = [];
  const licenseGaps = [];
  const errors = [];
  const supplements = {};
  const fontLicenses = {};
  for (const [relative, entry] of Object.entries(lock.packages).sort(
    ([a], [b]) => a.localeCompare(b),
  )) {
    if (!relative || entry.dev) continue;
    const directory = path.join(root, relative);
    const manifest = path.join(directory, "package.json");
    if (!fs.existsSync(manifest)) {
      if (!entry.optional)
        errors.push(
          `Required production package is not installed: ${relative}`,
        );
      continue;
    }
    const pkg = JSON.parse(fs.readFileSync(manifest, "utf8"));
    assert.equal(
      pkg.version,
      entry.version,
      `Installed version differs from lockfile: ${relative}`,
    );
    const identifier =
      typeof pkg.license === "string"
        ? pkg.license
        : (pkg.license || pkg.licenses ? JSON.stringify(pkg.license ?? pkg.licenses) : "Not declared");
    const licenseFiles = fs
      .readdirSync(directory)
      .filter(
        (file) =>
          /^(licen[cs]e|copying|copyright|notice|ofl)(?:[.\-_]|$)/i.test(
            file,
          ) && fs.statSync(path.join(directory, file)).isFile(),
      )
      .sort();
    const item = { name: pkg.name, version: pkg.version, license: identifier };
    packages.push(item);
    parts.push(
      separator +
        `${pkg.name} ${pkg.version}\nLicense identifier: ${identifier}\nInstalled path: ${relative}\n`,
    );
    if (!licenseFiles.length) {
      parts.push(
        "\nNo license or notice file was distributed at the package root.\n",
      );
      const supplementalLicense = supplementalLicenses.find(
        (item) => item.names.includes(pkg.name) && item.version === pkg.version,
      );
      if (supplementalLicense) {
        const contents = fs.readFileSync(
          path.join(root, "public", supplementalLicense.file),
          "utf8",
        );
        assert.equal(
          createHash("sha256").update(contents).digest("hex"),
          supplementalLicense.sha256,
          "Supplemental upstream license text changed",
        );
        supplements[supplementalLicense.file] = contents;
        supplementalLicenseFiles.push({ ...item, file: supplementalLicense.file, source: supplementalLicense.source, sha256: supplementalLicense.sha256 });
        parts.push(
          `\n${supplementalLicense.provenance}\nSource: ${supplementalLicense.source}\n\n${contents}`,
        );
      } else {
        missingLicenseFiles.push(item);
        errors.push(
          `Missing distributed license text: ${pkg.name} ${pkg.version}`,
        );
      }
    }
    if (/^(UNLICENSED|Not declared)$/i.test(identifier)) {
      licenseGaps.push(item);
      errors.push(`Unresolved license grant: ${pkg.name} ${pkg.version}`);
    }
    for (const file of licenseFiles) {
      const contents = fs.readFileSync(path.join(directory, file), "utf8");
      parts.push(`\n--- ${file} ---\n\n${contents}\n`);
      if (pkg.name?.startsWith("@fontsource/") && /SIL OPEN FONT LICENSE/i.test(contents))
        fontLicenses[`licenses/${pkg.name.split("/")[1]}-OFL.txt`] = contents;
    }
  }

  assert.equal(errors.length, 0, errors.join("\n"));
  return {
    files: {
      "LICENSE.txt": donorLicense,
      "THIRD_PARTY_NOTICES.txt": parts.join(""),
      ...fontLicenses,
      "licenses/PROVENANCE.txt": fs.readFileSync(
        path.join(root, "public/licenses/PROVENANCE.txt"),
        "utf8",
      ),
      ...supplements,
    },
    packages,
    missingLicenseFiles,
    supplementalLicenseFiles,
    licenseGaps,
  };
}

export function generateNotices({ check = false } = {}) {
  const result = collectNotices();
  for (const [relative, contents] of Object.entries(result.files)) {
    const destination = path.join(root, "public", relative);
    if (check)
      assert.equal(
        fs.readFileSync(destination, "utf8"),
        contents,
        `Stale or incomplete notice: ${relative}`,
      );
    else {
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, contents);
    }
  }
  return {
    packages: result.packages.length,
    missingLicenseFiles: result.missingLicenseFiles,
    supplementalLicenseFiles: result.supplementalLicenseFiles,
    licenseGaps: result.licenseGaps,
    redistributionStatus: result.licenseGaps.length
      ? "Unresolved license/attribution gaps; technical checks do not establish redistribution permission."
      : "No declared license gaps detected; not a legal opinion.",
  };
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  console.log(
    JSON.stringify(
      generateNotices({ check: process.argv.includes("--check") }),
      null,
      2,
    ),
  );
}
