import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import type { Plugin } from "vite";

export const reviewedRouterVersion = "7.18.2";
export const reviewedLoaderHash =
  "0a5332223eb6334c71f9af26aedf144328c2e1d30731e76eea5b8e2192579999";
export const unsupportedLoader = `async function loadRouteModule() {
  throw new Error("Shop admin does not support external React Router framework modules.");
}`;

/**
 * This Shop admin uses explicit local routes, not React Router's SSR/framework manifest.
 * The framework prefetch component retains an unused arbitrary import(route.module)
 * loader in the default bundle. Replace ONLY that reviewed function with a refusal.
 * Any changed dependency version, source function, or match count fails the build.
 * This does not modify the House bridge or Runtime protocol.
 */
export function stripFrameworkLoader(
  code: string,
  filename: string,
  version: string,
) {
  assert.equal(
    version,
    reviewedRouterVersion,
    "Review React Router version before changing its framework loader",
  );
  const parsed = ts.createSourceFile(
    filename,
    code,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS,
  );
  const matches = parsed.statements.filter(
    (node): node is ts.FunctionDeclaration =>
      ts.isFunctionDeclaration(node) && node.name?.text === "loadRouteModule",
  );
  assert.equal(
    matches.length,
    1,
    "Expected exactly one top-level React Router framework loader",
  );
  const original = matches[0];
  assert.equal(
    createHash("sha256").update(original.getText(parsed)).digest("hex"),
    reviewedLoaderHash,
    "React Router framework loader source changed; review before building",
  );
  return (
    code.slice(0, original.getStart(parsed)) +
    unsupportedLoader +
    code.slice(original.end)
  );
}

export function stripUnusedRouterFramework(): Plugin {
  let transformed = 0;
  let version = "";
  return {
    name: "shop-strip-reviewed-framework-loader",
    apply: "build",
    enforce: "pre",
    buildStart() {
      transformed = 0;
      const filename = path.resolve(
        import.meta.dirname,
        "../node_modules/react-router/package.json",
      );
      version = JSON.parse(fs.readFileSync(filename, "utf8")).version;
      assert.equal(
        version,
        reviewedRouterVersion,
        "Review React Router version before building Shop admin",
      );
    },
    transform(code, id) {
      if (
        !/\/node_modules\/react-router\/dist\/(?:development|production)\/[^/]+\.mjs$/.test(
          id.split("?")[0],
        ) ||
        !code.includes("async function loadRouteModule(")
      )
        return null;
      transformed += 1;
      assert.equal(
        transformed,
        1,
        "React Router framework loader unexpectedly appeared in multiple modules",
      );
      return { code: stripFrameworkLoader(code, id, version), map: null };
    },
    buildEnd(error) {
      if (!error)
        assert.equal(
          transformed,
          1,
          "Reviewed React Router framework loader was not transformed",
        );
    },
  };
}
