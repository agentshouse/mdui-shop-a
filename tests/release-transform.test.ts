import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import {
  reviewedRouterVersion,
  stripFrameworkLoader,
  unsupportedLoader,
} from "../scripts/strip-framework-loader";

const directory = path.resolve(
  import.meta.dirname,
  "../node_modules/react-router/dist/development",
);
const filename = fs
  .readdirSync(directory)
  .filter((file) => file.endsWith(".mjs"))
  .map((file) => path.join(directory, file))
  .find((file) =>
    fs.readFileSync(file, "utf8").includes("async function loadRouteModule("),
  )!;
const original = fs.readFileSync(filename, "utf8");

describe("reviewed React Router framework loader removal", () => {
  it("replaces exactly the pinned loader and preserves all surrounding dependency source", () => {
    const output = stripFrameworkLoader(
      original,
      filename,
      reviewedRouterVersion,
    );
    const parsed = ts.createSourceFile(
      filename,
      original,
      ts.ScriptTarget.Latest,
      true,
    );
    const loader = parsed.statements.find(
      (node) =>
        ts.isFunctionDeclaration(node) && node.name?.text === "loadRouteModule",
    )!;
    expect(output).toBe(
      original.slice(0, loader.getStart(parsed)) +
        unsupportedLoader +
        original.slice(loader.end),
    );
    expect(unsupportedLoader).not.toMatch(
      /\bimport\s*\(|\bfetch\s*\(|location/,
    );
    expect(unsupportedLoader).toContain("throw new Error");
  });
  it("fails closed for a changed dependency version", () => {
    expect(() => stripFrameworkLoader(original, filename, "7.18.3")).toThrow(
      /version/,
    );
  });
  it("fails closed if the reviewed loader changes", () => {
    expect(() =>
      stripFrameworkLoader(
        original.replace(
          "route.id in routeModulesCache",
          "route.id in changedCache",
        ),
        filename,
        reviewedRouterVersion,
      ),
    ).toThrow(/source changed/);
  });
  it("fails closed if the loader is missing or duplicated", () => {
    expect(() =>
      stripFrameworkLoader("", filename, reviewedRouterVersion),
    ).toThrow(/exactly one/);
    expect(() =>
      stripFrameworkLoader(
        original + "\nasync function loadRouteModule() {}",
        filename,
        reviewedRouterVersion,
      ),
    ).toThrow(/exactly one/);
  });
});
