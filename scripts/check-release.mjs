import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import ts from "typescript";
import { collectNotices, donorCommit, root } from "./generate-notices.mjs";

const reviewedVitePreloadHash =
  "a1357374a46e2b20887824e5c33701ad0b94942c8771379fd15af57935a8c793";
const reviewedVitePreloadSource =
  'function(){let e=document.createElement(`link`).relList;if(e&&e.supports&&e.supports(`modulepreload`))return;for(let e of document.querySelectorAll(`link[rel="modulepreload"]`))n(e);new MutationObserver(e=>{for(let t of e)if(t.type===`childList`)for(let e of t.addedNodes)e.tagName===`LINK`&&e.rel===`modulepreload`&&n(e)}).observe(document,{childList:!0,subtree:!0});function t(e){let t={};return e.integrity&&(t.integrity=e.integrity),e.referrerPolicy&&(t.referrerPolicy=e.referrerPolicy),t.credentials=e.crossOrigin===`use-credentials`?`include`:e.crossOrigin===`anonymous`?`omit`:`same-origin`,t}function n(e){if(e.ep)return;e.ep=!0;let n=t(e);fetch(e.href,n)}}';
const reviewedPosterHelper = {
  source: "src/assets.ts",
  sha256: "fff7b41675395cc777c95103798e8154a3ece919b2e1957bc5f66c3476e35fce",
};
const reviewedRoomImage = { source: "src/RoomImage.tsx", sha256: "97744b78f3c77e73d79210c9778c398ff245513ffde2f62898fe9eb8a61137c2" };
const reviewedRichText = [
  { source: "src/safeRichText.ts", sha256: "5fdd96b2474980d3c8600b9e5920e333f3643933812d99b51fb972d224deb80c" },
  { source: "src/products/SafeRichTextInput.tsx", sha256: "221b218457183beb0ae00ee40451ccc9ec8f3a8cf8fb9e88a08f17ee061487f1" },
];
function posterHelperReviewed() {
  return createHash("sha256").update(fs.readFileSync(path.join(root, reviewedPosterHelper.source))).digest("hex") === reviewedPosterHelper.sha256;
}
function logicalPosterId(node) {
  if (!ts.isStringLiteralLike(node) || !/^\/posters\/(?:0[1-9]|1[0-2])\.svg$/.test(node.text)) return false;
  // These values identify a choice; they are not rendered URLs. Only object keys
  // and explicit id properties of the pinned local helper get this exception.
  const parent = node.parent;
  return ts.isPropertyAssignment(parent) &&
    (parent.name === node || (parent.initializer === node && parent.name.getText().replace(/["'`]/g, "") === "id")) && posterHelperReviewed();
}
const dist = path.join(root, "dist");
const references = new Set();
const checkedSource = new Set();
const networkIssues = [];
const forbiddenImports =
  /(?:^|\/)(?:sockette|socket\.io|firebase|plausible-tracker|@microsoft\/clarity|sentry|@supabase|ra-supabase-core|ra-data-fakerest|ra-data-simple-rest|ra-data-graphql|json-graphql-server|data-generator-retail|fakerest|msw|faker)(?:$|\/)/i;
const assetExtension =
  /\.(?:m?js|css|woff2?|ttf|otf|eot|svg|png|jpe?g|gif|webp|avif|ico|wasm|mp3|mp4|ogg|wav)(?:[?#].*)?$/i;
const external = /^(?:[a-z][a-z\d+.-]*:|\/\/)/i;
const harmlessURL =
  /^(?:https?:\/\/www\.w3\.org\/(?:1999\/xhtml|2000\/svg|2000\/xmlns\/|1998\/Math\/MathML|1999\/xlink|XML\/1998\/namespace)|https:\/\/react\.dev\/errors\/|https:\/\/mui\.com\/production-error\/\?code=|https?:\/\/(?:opensource\.org|spdx\.org|scripts\.sil\.org)\/(?:licenses|OFL)|https:\/\/openfontlicense\.org\/|https?:\/\/json-schema\.org\/(?:draft|schema)|https:\/\/github\.github\.com\/gfm\/)/i;
const scriptExtensions = /\.[cm]?[jt]sx?$/i;

function walk(directory) {
  const result = [];
  for (const entry of fs
    .readdirSync(directory, { withFileTypes: true })
    .sort((a, b) => a.name.localeCompare(b.name))) {
    const filename = path.join(directory, entry.name);
    assert(
      !entry.isSymbolicLink(),
      `Release/source must not contain symlink: ${filename}`,
    );
    if (entry.isDirectory()) result.push(...walk(filename));
    else {
      assert(entry.isFile(), `Not a regular file: ${filename}`);
      result.push(filename);
    }
  }
  return result;
}

function localAsset(value, from, { documentRelative = false } = {}) {
  value = value.trim().replace(/&amp;/g, "&");
  if (!value || value.startsWith("#")) return;
  if (/^data:/i.test(value)) {
    const match = /^data:([^;,]+)(;base64)?,([\s\S]*)$/i.exec(value);
    assert(
      match &&
        /^(?:image\/(?:png|jpe?g|gif|webp|avif|svg\+xml)|font\/(?:woff2?|ttf|otf))$/i.test(
          match[1],
        ),
      `Unsupported embedded asset in ${from}`,
    );
    if (/svg\+xml/i.test(match[1]))
      scanMarkup(
        match[2]
          ? Buffer.from(match[3], "base64").toString("utf8")
          : decodeURIComponent(match[3]),
        from + ".inline.svg",
        true,
      );
    return;
  }
  assert(
    !external.test(value),
    `External asset ${value} in ${path.relative(root, from)}`,
  );
  assert(!value.includes("\\"), `Backslash in asset path: ${value}`);
  const clean = decodeURIComponent(value.split(/[?#]/)[0]);
  const target = clean.startsWith("/")
    ? path.resolve(dist, "." + clean)
    : path.resolve(documentRelative ? dist : path.dirname(from), clean);
  assert(target.startsWith(dist + path.sep), `Asset escapes release: ${value}`);
  assert(
    fs.existsSync(target) && fs.statSync(target).isFile(),
    `Missing asset ${value} in ${path.relative(root, from)}`,
  );
  references.add(path.relative(dist, target).split(path.sep).join("/"));
}

function scanCSS(css, filename, built) {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const match of clean.matchAll(
    /url\(\s*(?:"([^"\n]+)"|'([^'\n]+)'|([^\s)]+))\s*\)/gi,
  )) {
    const value = match[1] ?? match[2] ?? match[3];
    if (built) localAsset(value, filename);
    else
      assert(
        !external.test(value) || /^data:/i.test(value),
        `External source CSS asset ${value} in ${filename}`,
      );
  }
  for (const match of clean.matchAll(/@import\s+['"]([^'"]+)['"]/gi)) {
    if (built) localAsset(match[1], filename);
    else
      assert(
        !external.test(match[1]),
        `External source CSS import ${match[1]} in ${filename}`,
      );
  }
}

function parseSource(filename, source) {
  return ts.createSourceFile(
    filename,
    source,
    ts.ScriptTarget.Latest,
    true,
    filename.endsWith(".tsx")
      ? ts.ScriptKind.TSX
      : filename.endsWith(".ts")
        ? ts.ScriptKind.TS
        : ts.ScriptKind.JS,
  );
}

function vitePreloadFetch(node, source) {
  // The only allowed fetch is the exact reviewed Vite 8.3.2 preload polyfill.
  // It loads modulepreload links, independently checked as local release assets.
  // A changed body or an extra request fails closed instead of inheriting trust.
  let current = node.parent;
  while (current && !ts.isSourceFile(current)) {
    if (
      (ts.isFunctionExpression(current) || ts.isArrowFunction(current)) &&
      createHash("sha256").update(current.getText(source)).digest("hex") ===
        reviewedVitePreloadHash
    )
      return true;
    current = current.parent;
  }
  return false;
}

function inertSchemePrefix(node, source) {
  if (!/^https?:\/\/$/.test(node.text)) return false;
  // Literal schemes used only for string cleanup are not destinations. Templates
  // are allowed solely for inert website-field normalization or URL label
  // parsing. Actual networking APIs and resource references are checked separately.
  if (ts.isStringLiteralLike(node)) return true;
  let current = node.parent;
  for (let depth = 0; current && depth < 4; depth++, current = current.parent) {
    if (
      ts.isBinaryExpression(current) &&
      current.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      ts.isPropertyAccessExpression(current.left) &&
      current.left.name.text === "website"
    )
      return true;
    if (
      ts.isNewExpression(current) &&
      current.expression.getText(source) === "URL"
    )
      return true;
    if (ts.isCallExpression(current)) return false;
  }
  return false;
}

function routerParsingBase(node, source) {
  if (
    node.text !== "http://localhost" ||
    !ts.isVariableDeclaration(node.parent) ||
    !ts.isIdentifier(node.parent.name)
  )
    return false;
  const name = node.parent.name.text;
  let owner = node.parent;
  while (
    owner &&
    !ts.isFunctionDeclaration(owner) &&
    !ts.isFunctionExpression(owner) &&
    !ts.isArrowFunction(owner)
  )
    owner = owner.parent;
  if (!owner) return false;
  const body = owner.getText(source);
  // React Router's URL parser uses this fallback only to construct URL objects,
  // and immediately replaces it with window.location.origin where available.
  return (
    body.length < 1200 &&
    body.includes("location.origin") &&
    body.includes("location.href") &&
    new RegExp(
      `new URL\\([^;]*,\\s*${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\)`,
    ).test(body)
  );
}

function networkCheck(source, filename, built = false) {
  const parsed = parseSource(filename, source);
  const issues = [];
  const reviewedRoomBlobSource = !built && path.resolve(filename) === path.join(root, reviewedRoomImage.source)
    && createHash("sha256").update(source).digest("hex") === reviewedRoomImage.sha256;
  const localNames = new Set();
  const importedAssets = new Set();
  const importedPosterFunctions = new Set();
  for (const statement of parsed.statements) {
    if (
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteralLike(statement.moduleSpecifier) &&
      assetExtension.test(statement.moduleSpecifier.text) &&
      statement.importClause?.name
    )
      importedAssets.add(statement.importClause.name.text);
    if (!built && ts.isImportDeclaration(statement) && ts.isStringLiteralLike(statement.moduleSpecifier)
      && path.resolve(path.dirname(filename), statement.moduleSpecifier.text.replace(/\.ts$/, "")) === path.join(root, "src/assets")
      && statement.importClause?.namedBindings && ts.isNamedImports(statement.importClause.namedBindings))
      for (const binding of statement.importClause.namedBindings.elements)
        if (["safePoster"].includes(binding.propertyName?.text ?? binding.name.text) && posterHelperReviewed())
          importedPosterFunctions.add(binding.name.text);
  }
  function bindings(node) {
    if (
      (ts.isVariableDeclaration(node) ||
        ts.isParameter(node) ||
        ts.isFunctionDeclaration(node)) &&
      node.name
    ) {
      const addName = (name) => {
        if (ts.isIdentifier(name)) localNames.add(name.text);
        else if (
          ts.isObjectBindingPattern(name) ||
          ts.isArrayBindingPattern(name)
        )
          for (const element of name.elements)
            if (ts.isBindingElement(element)) addName(element.name);
      };
      addName(node.name);
    }
    ts.forEachChild(node, bindings);
  }
  bindings(parsed);
  const add = (node, message) => {
    const pos = parsed.getLineAndCharacterOfPosition(node.getStart(parsed));
    issues.push(
      `${path.relative(root, filename)}:${pos.line + 1}:${pos.character + 1}: ${message}`,
    );
  };
  function visit(node) {
    if (
      !built &&
      ts.isJsxAttribute(node) &&
      /^(?:src|srcSet|poster|image)$/.test(node.name.getText(parsed))
    ) {
      const initializer = node.initializer;
      const value =
        initializer && ts.isJsxExpression(initializer)
          ? initializer.expression
          : initializer;
      if (
        !value ||
        !(
          ts.isStringLiteralLike(value) ||
          (ts.isIdentifier(value) && importedAssets.has(value.text)) ||
          (reviewedRoomBlobSource && node.name.getText(parsed) === "src" && ts.isIdentifier(value) && value.text === "source") ||
          (ts.isCallExpression(value) && ts.isIdentifier(value.expression) && importedPosterFunctions.has(value.expression.text)
            && !localNames.has(value.expression.text))
        )
      )
        add(node, "Unverifiable dynamic JSX asset; use a local imported asset");
      if (
        value &&
        ts.isStringLiteralLike(value) &&
        external.test(value.text) &&
        !/^data:/i.test(value.text)
      )
        add(node, "External JSX resource URL");
    }
    if (
      ts.isPropertyAssignment(node) &&
      /^(?:src|srcSet|poster|image)$/.test(
        node.name.getText(parsed).replace(/["'`]/g, ""),
      ) &&
      ts.isStringLiteralLike(node.initializer) &&
      external.test(node.initializer.text) &&
      !/^data:/i.test(node.initializer.text)
    )
      add(node, "External resource property URL");
    if (
      ts.isStringLiteralLike(node) ||
      node.kind === ts.SyntaxKind.TemplateHead
    ) {
      const value = node.text;
      if (
        /^(?:https?|wss?):\/\//i.test(value) &&
        !harmlessURL.test(value) &&
        !inertSchemePrefix(node, parsed) &&
        !(built && routerParsingBase(node, parsed))
      )
        add(node, `External URL remains: ${value.slice(0, 180)}`);
      if (/^\/\/[^/#\s]/.test(value))
        add(
          node,
          `Protocol-relative external URL remains: ${value.slice(0, 180)}`,
        );
    }
    if (
      ts.isElementAccessExpression(node) &&
      ts.isStringLiteralLike(node.argumentExpression)
    ) {
      const object = node.expression.getText(parsed);
      const member = node.argumentExpression.text;
      if (
        [
          "WebSocket",
          "XMLHttpRequest",
          "EventSource",
          "RTCPeerConnection",
          "importScripts",
          "sendBeacon",
        ].includes(member) ||
        (member === "fetch" && /^(?:window|globalThis|self)$/.test(object))
      )
        add(node, `Forbidden computed network API: ${member}`);
    }
    if (ts.isIdentifier(node)) {
      const name = node.text;
      const memberName =
        ts.isPropertyAccessExpression(node.parent) && node.parent.name === node;
      const propertyName =
        (ts.isPropertyAssignment(node.parent) ||
          ts.isMethodDeclaration(node.parent) ||
          ts.isPropertySignature(node.parent)) &&
        node.parent.name === node;
      if (
        [
          "WebSocket",
          "XMLHttpRequest",
          "EventSource",
          "RTCPeerConnection",
          "importScripts",
          "sendBeacon",
        ].includes(name)
      )
        add(node, `Forbidden network API: ${name}`);
      if (
        name === "fetch" &&
        ((!memberName && !propertyName) ||
          (memberName &&
            /^(?:window|globalThis|self)$/.test(
              node.parent.expression.getText(parsed),
            )))
      ) {
        if (!(built && vitePreloadFetch(node, parsed)))
          add(node, "Forbidden network API: fetch");
      }
    }
    if (ts.isCallExpression(node)) {
      const expression = node.expression.getText(parsed);
      if (
        /^(?:window|globalThis|self)\.open$/.test(expression) ||
        (expression === "open" && !localNames.has("open")) ||
        /^(?:window\.)?location\.(?:assign|replace)$/.test(expression)
      )
        add(node, `Outside navigation API: ${expression}`);
      if (/serviceWorker\s*\.\s*register$/.test(expression))
        add(node, "Service worker registration remains");
    }
    ts.forEachChild(node, visit);
  }
  visit(parsed);
  return { parsed, issues };
}

function scanJS(source, filename, built) {
  const { parsed, issues } = networkCheck(source, filename, built);
  networkIssues.push(...issues);
  const imports = [];
  const handled = new Set();
  function reference(node, documentRelative = false) {
    if (!node || !ts.isStringLiteralLike(node)) return;
    handled.add(node);
    if (built) localAsset(node.text, filename, { documentRelative });
    else imports.push(node.text);
  }
  function visit(node) {
    if (ts.isImportDeclaration(node) && !node.importClause?.isTypeOnly) {
      assert(
        !/^data:/i.test(node.moduleSpecifier.text),
        `Embedded script import cannot be verified: ${filename}`,
      );
      reference(node.moduleSpecifier);
    }
    if (ts.isExportDeclaration(node) && !node.isTypeOnly)
      reference(node.moduleSpecifier);
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword
    ) {
      assert(
        node.arguments[0] && ts.isStringLiteralLike(node.arguments[0]),
        `Unverifiable computed import in ${filename}`,
      );
      reference(node.arguments[0]);
    }
    if (
      ts.isNewExpression(node) &&
      node.expression.getText(parsed) === "URL" &&
      node.arguments?.[1]?.getText(parsed) === "import.meta.url"
    )
      reference(node.arguments[0]);
    if (
      ts.isNewExpression(node) &&
      /^(?:Worker|SharedWorker)$/.test(node.expression.getText(parsed))
    ) {
      const value = node.arguments?.[0];
      assert(
        value &&
          (ts.isStringLiteralLike(value) ||
            (ts.isNewExpression(value) &&
              value.expression.getText(parsed) === "URL")),
        `Unverifiable worker URL in ${filename}`,
      );
      if (ts.isStringLiteralLike(value)) reference(value, true);
    }
    ts.forEachChild(node, visit);
  }
  visit(parsed);
  if (built) {
    // Includes Vite's dependency/preload tables and font/image URL constants,
    // in addition to the import declarations and new URL references above.
    const literals = (node) => {
      if (
        ts.isStringLiteralLike(node) &&
        !handled.has(node) &&
        !logicalPosterId(node) &&
        assetExtension.test(node.text) &&
        /^(?:\.?\.?\/|assets\/|static\/|fonts\/)/.test(node.text)
      ) {
        localAsset(node.text, filename, {
          documentRelative: /^(?:\.\/)?(?:assets|static|fonts)\//.test(
            node.text,
          ),
        });
      }
      if (
        ts.isStringLiteralLike(node) &&
        /^data:image\/svg\+xml(?:;[^,]*)?,/i.test(node.text)
      )
        localAsset(node.text, filename);
      if (ts.isStringLiteralLike(node) && /url\(/i.test(node.text))
        scanCSS(node.text, filename, true);
      ts.forEachChild(node, literals);
    };
    literals(parsed);
  }
  return imports;
}

function scanMarkup(source, filename, built) {
  const clean = source.replace(/<!--[\s\S]*?-->/g, "");
  assert(!/<base\b/i.test(clean), `Base URL can escape release: ${filename}`);
  const sourceImports = [];
  for (const tag of clean.matchAll(/<([a-z][\w:-]*)\b[^>]*>/gi)) {
    const name = tag[1].toLowerCase();
    assert(
      !/\bon[a-z]+\s*=/i.test(tag[0]),
      `Inline markup event handler remains: ${filename}`,
    );
    assert(
      !["animate", "set", "animatetransform", "animatemotion"].includes(name),
      `Active SVG content must be explicitly reviewed: ${filename}`,
    );
    if (["iframe", "object", "embed"].includes(name))
      assert.fail(`Embedded outside-capable document remains: ${filename}`);
    if (name === "meta" && /http-equiv\s*=\s*['"]?refresh\b/i.test(tag[0]))
      assert.fail(`Meta redirect remains: ${filename}`);
    for (const attribute of tag[0].matchAll(
      /\b(src|href|xlink:href|poster|srcset|style|action)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi,
    )) {
      const key = attribute[1].toLowerCase();
      const value = attribute[2] ?? attribute[3] ?? attribute[4];
      if (key === "style") {
        scanCSS(value, filename, built);
        continue;
      }
      if (key === "action") {
        assert(!value, `Form submission remains in ${filename}`);
        continue;
      }
      if (name === "a") {
        assert(
          !external.test(value) || harmlessURL.test(value),
          `External navigation URL in ${filename}: ${value}`,
        );
        continue;
      }
      if (key === "srcset") {
        assert(
          !value.includes("data:"),
          `Inline srcset must be made explicit for verification: ${filename}`,
        );
        for (const item of value.split(","))
          if (built) localAsset(item.trim().split(/\s+/)[0], filename);
        continue;
      }
      if (built) localAsset(value, filename);
      else {
        assert(
          !external.test(value) || /^data:/i.test(value),
          `External source markup asset ${value} in ${filename}`,
        );
        if (name === "script" || name === "link") sourceImports.push(value);
      }
    }
  }
  for (const match of clean.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi))
    scanCSS(match[1], filename, built);
  for (const match of clean.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi))
    if (
      match[2].trim() &&
      !/type\s*=\s*['"](?:application\/ld\+json|application\/json)['"]/i.test(
        match[1],
      )
    )
      scanJS(match[2], filename + ".js", built);
  return sourceImports;
}

function scanProductionSource() {
  assert(posterHelperReviewed(), "Reviewed local poster helper changed; inspect before updating its checksum");
  for (const review of [...reviewedRichText, reviewedRoomImage])
    assert.equal(createHash("sha256").update(fs.readFileSync(path.join(root, review.source))).digest("hex"), review.sha256,
      `Reviewed rich-text resource boundary changed: ${review.source}`);
  const configFile = ts.readConfigFile(
    path.join(root, "tsconfig.json"),
    ts.sys.readFile,
  );
  assert(!configFile.error, "Unable to read tsconfig.json");
  const options = ts.parseJsonConfigFileContent(
    configFile.config,
    ts.sys,
    root,
  ).options;
  function resolve(specifier, filename) {
    assert(
      !forbiddenImports.test(specifier),
      `Forbidden service dependency: ${specifier}`,
    );
    assert(!external.test(specifier), `External source import: ${specifier}`);
    const clean = specifier.split("?")[0];
    const resolved = ts.resolveModuleName(clean, filename, options, ts.sys)
      .resolvedModule?.resolvedFileName;
    if (resolved)
      return resolved.includes(`${path.sep}node_modules${path.sep}`)
        ? null
        : resolved;
    for (const [pattern, substitutions] of Object.entries(
      options.paths ?? {},
    )) {
      const [prefix, suffix = ""] = pattern.split("*");
      if (!clean.startsWith(prefix) || !clean.endsWith(suffix)) continue;
      const middle = clean.slice(
        prefix.length,
        suffix ? -suffix.length : undefined,
      );
      for (const substitution of substitutions) {
        const candidate = path.resolve(
          options.baseUrl ?? root,
          substitution.replace("*", middle),
        );
        if (fs.existsSync(candidate)) return candidate;
      }
    }
    if (/^[^./]/.test(clean)) {
      // Package styles are emitted by Vite and checked in dist. Resolve local
      // aliases before concluding that an unresolved style is package-owned.
      const local = path.join(root, "src", clean);
      if (fs.existsSync(local)) return local;
      if (fs.existsSync(path.join(root, "node_modules", clean))) return null;
    }
    const candidate = clean.startsWith("/")
      ? path.join(root, clean)
      : path.resolve(path.dirname(filename), clean);
    if (fs.existsSync(candidate)) return candidate;
    assert.fail(
      `Unresolved production source import ${specifier} from ${filename}`,
    );
  }
  function visit(filename) {
    filename = path.resolve(filename);
    if (checkedSource.has(filename) || !fs.statSync(filename).isFile()) return;
    checkedSource.add(filename);
    const source = fs.readFileSync(filename, "utf8");
    let imports = [];
    if (scriptExtensions.test(filename))
      imports = scanJS(source, filename, false);
    else if (/\.(?:html|svg)$/i.test(filename))
      imports = scanMarkup(source, filename, false);
    else if (/\.(?:css|scss|sass)$/i.test(filename)) {
      scanCSS(source, filename, false);
      for (const match of source.matchAll(
        /@(?:use|forward|import)\s+['"]([^'"]+)['"]/g,
      )) {
        if (match[1].startsWith("sass:")) continue;
        const name = match[1];
        const directory = path.dirname(filename);
        const candidates = [directory, path.join(root, "src")].flatMap((base) =>
          [
            name,
            `${name}.scss`,
            path.join(path.dirname(name), `_${path.basename(name)}.scss`),
          ].map((item) => path.resolve(base, item)),
        );
        const stylesheet = candidates.find((item) => fs.existsSync(item));
        if (stylesheet) visit(stylesheet);
        else {
          const resolved = resolve(name, filename);
          if (resolved) visit(resolved);
        }
      }
    }
    for (const specifier of imports) {
      const resolved = resolve(specifier, filename);
      if (resolved) visit(resolved);
    }
  }
  visit(path.join(root, "index.html"));
}

function selfTest() {
  const filename = path.join(root, "src/audit-fixture.ts");
  for (const source of [
    "fetch('/api/board')",
    "window.fetch('/api/board')",
    "window['fetch']('/api/board')",
    "const f = fetch;",
    "new WebSocket('wss://host.test')",
    "navigator.sendBeacon('/track', 'x')",
    "new EventSource('/events')",
    "const x = 'https://react-admin-telemetry.marmelab.com/react-admin-telemetry'",
    "const x = `https://${host}/api`",
    "window.open('https://example.com')",
    "navigator.serviceWorker.register('/sw.js')",
    "globalThis['WebSocket']('wss://host.test')",
  ])
    assert(
      networkCheck(source, filename).issues.length,
      `Network scanner missed ${source}`,
    );
  assert.equal(
    networkCheck(
      "// https://marmelab.com is donor documentation\nconst license = 'https://opensource.org/licenses/MIT'; const x = 'http://www.w3.org/2000/svg';",
      filename,
    ).issues.length,
    0,
  );
  assert.equal(
    networkCheck("const x = 'https://react.dev/errors/123';", filename, true)
      .issues.length,
    0,
  );
  assert.equal(
    networkCheck(
      "const a = 'https://'; x.website = `https://${host}`; new URL(`https://${host}`);",
      filename,
    ).issues.length,
    0,
  );
  assert(networkCheck("fetch(`https://${host}`)", filename).issues.length);
  assert(
    networkCheck(
      '<img src="https://react.dev/errors/123" />',
      path.join(root, "src/audit-fixture.tsx"),
    ).issues.length,
  );
  assert(
    networkCheck(
      'const props={src:"https://react.dev/errors/123"};',
      filename,
      true,
    ).issues.length,
  );
  assert(
    networkCheck(
      "<img src={record.avatar} />",
      path.join(root, "src/audit-fixture.tsx"),
    ).issues.length,
  );
  for (const prop of ["src", "srcSet", "poster", "image"])
    assert(networkCheck(`<CardMedia ${prop}={record.image} />`, path.join(root, "src/audit-fixture.tsx")).issues.length,
      `Dynamic resource property escaped audit: ${prop}`);
  assert.equal(
    networkCheck(
      'import avatar from "./local.svg"; const view = <img src={avatar} />;',
      path.join(root, "src/audit-fixture.tsx"),
    ).issues.length,
    0,
  );
  assert.equal(
    networkCheck("function menu(open) { open(); }", filename).issues.length,
    0,
  );
  const imageFile = path.join(root, reviewedRoomImage.source);
  const imageSource = fs.readFileSync(imageFile, "utf8");
  assert.equal(networkCheck(imageSource, imageFile).issues.length, 0, "Reviewed Room image helper changed");
  assert(networkCheck(imageSource, path.join(root, "src/unreviewed-image.tsx")).issues.length);
  assert(networkCheck(imageSource.replace("src={source}", "src={value}"), imageFile).issues.length);
  const importedHelper = 'import {safePoster} from "./assets";';
  assert.equal(networkCheck(importedHelper + '<img src={safePoster(record.image)} />', path.join(root, 'src/audit-fixture.tsx')).issues.length, 0);
  assert(networkCheck('<img src={safePoster(record.image)} />', path.join(root, 'src/audit-fixture.tsx')).issues.length);
  assert(networkCheck(importedHelper + 'function fake(safePoster) { return <img src={safePoster(record.image)} /> }', path.join(root, 'src/audit-fixture.tsx')).issues.length);
  const logicalFixture = parseSource(filename, 'const x = [{id:"/posters/01.svg"}]; const y = {"/posters/01.svg":local}; const z={src:"/posters/01.svg"};');
  const logicalResults = [];
  function inspectLogical(node) { if(ts.isStringLiteralLike(node)) logicalResults.push(logicalPosterId(node)); ts.forEachChild(node, inspectLogical); }
  inspectLogical(logicalFixture);
  assert.deepEqual(logicalResults, [true, true, false], "A real src asset must not be mistaken for a logical identifier");
  const parserBase =
    'function parse(e,t){let base="http://localhost"; if(e)base=e.location.origin==="null"?e.location.href:e.location.origin;return new URL(t,base)}';
  assert.equal(networkCheck(parserBase, filename, true).issues.length, 0);
  assert(
    networkCheck('const base="http://localhost";', filename, true).issues
      .length,
  );
  assert(
    networkCheck(
      parserBase.replace(
        "return new URL(t,base)",
        "fetch(base);return new URL(t,base)",
      ),
      filename,
      true,
    ).issues.length,
  );
  assert.throws(
    () =>
      scanMarkup(
        '<svg onload="alert(1)"></svg>',
        path.join(dist, "fixture.svg"),
        true,
      ),
    /Inline markup event/,
  );
  const preload = "(" + reviewedVitePreloadSource + ")()";
  assert(
    networkCheck(
      preload.replace("fetch(e.href,n)", "fetch(e.href,n);fetch(other)"),
      filename,
      true,
    ).issues.length,
  );
  assert.equal(networkCheck(preload, filename, true).issues.length, 0);
  assert(networkCheck(preload, filename, false).issues.length);
  assert(networkCheck('fetch("./data.json")', filename, true).issues.length);
  assert.throws(
    () =>
      localAsset(
        "https://example.com/font.woff2",
        path.join(dist, "index.html"),
      ),
    /External asset/,
  );
  assert.throws(
    () =>
      localAsset(
        'data:text/javascript,fetch("https://evil.test")',
        path.join(dist, "index.html"),
      ),
    /Unsupported embedded/,
  );
  assert.throws(
    () =>
      localAsset(
        "data:image/svg+xml,%3Csvg%3E%3Cimage%20href%3D%22https%3A%2F%2Fevil.test%2Fa.png%22%2F%3E%3C%2Fsvg%3E",
        path.join(dist, "index.html"),
      ),
    /External asset/,
  );
  assert.throws(
    () => localAsset("../../outside.png", path.join(dist, "index.html")),
    /escapes release/,
  );
  assert.throws(
    () =>
      scanCSS(
        '@import "https://example.com/style.css";',
        path.join(dist, "style.css"),
        true,
      ),
    /External asset/,
  );
  assert.throws(
    () =>
      scanMarkup(
        '<script src="https://example.com/app.js"></script>',
        path.join(dist, "index.html"),
        true,
      ),
    /External asset/,
  );
  console.log(
    JSON.stringify(
      {
        result: "passed",
        selfTest:
          "Forbidden-network AST and external/escaping asset positive and negative fixtures",
      },
      null,
      2,
    ),
  );
}

if (process.argv.includes("--network-report")) {
  const issues = walk(dist).filter(file => /\.m?js$/i.test(file)).flatMap(filename =>
    networkCheck(fs.readFileSync(filename, "utf8"), filename, true).issues);
  console.log(JSON.stringify({ diagnosticOnly: true, result: issues.length ? "failed" : "passed", issues }, null, 2));
  process.exitCode = issues.length ? 1 : 0;
}
else if (process.argv.includes("--self-test")) selfTest();
else if (process.argv.includes("--source-only")) {
  scanProductionSource();
  assert.equal(networkIssues.length, 0, networkIssues.join("\n"));
  console.log(
    JSON.stringify(
      {
        result: "passed",
        sourceOnly: true,
        productionSourceFilesChecked: [...checkedSource]
          .map((filename) => path.relative(root, filename))
          .sort(),
      },
      null,
      2,
    ),
  );
} else {
  const files = walk(dist);
  const bytes = files.reduce(
    (sum, filename) => sum + fs.statSync(filename).size,
    0,
  );
  assert(files.length <= 2000, `Release has ${files.length} files, limit 2000`);
  assert(bytes <= 20 * 1024 * 1024, `Release has ${bytes} bytes, limit 20 MiB`);
  const manifest = JSON.parse(
    fs.readFileSync(path.join(dist, "app.json"), "utf8"),
  );
  assert.equal(typeof manifest.entry, "string", "Manifest entry missing");
  assert(
    /^(?:\.\/)?index\.html$/.test(manifest.entry),
    "Manifest must point to the root index.html entry",
  );
  localAsset(manifest.entry, path.join(dist, "app.json"));
  for (const filename of files) {
    if (/\.(?:html|svg)$/i.test(filename))
      scanMarkup(fs.readFileSync(filename, "utf8"), filename, true);
    else if (/\.css$/i.test(filename))
      scanCSS(fs.readFileSync(filename, "utf8"), filename, true);
    else if (/\.m?js$/i.test(filename))
      scanJS(fs.readFileSync(filename, "utf8"), filename, true);
    assert(!/(?:^|\/)(?:mockServiceWorker|service-worker|sw)\.js$/i.test(filename), `Service-worker file remains: ${filename}`);
    assert(
      !/\.(?:map|ts|tsx)$/i.test(filename),
      `Unneeded source artifact in release: ${filename}`,
    );
  }
  scanProductionSource();
  assert.equal(networkIssues.length, 0, networkIssues.join("\n"));
  const fonts = files.filter((filename) =>
    /\.(?:woff2?|ttf|otf)$/i.test(filename),
  );
  // System font stacks need no files; any bundled fonts must be local and referenced.
  for (const filename of fonts)
    assert(
      references.has(path.relative(dist, filename).split(path.sep).join("/")),
      `Unreferenced font asset: ${filename}`,
    );
  for (const name of ["app.json", "schema.yaml"])
    assert(
      fs.readFileSync(path.join(root, name), "utf8") ===
        fs.readFileSync(path.join(dist, name), "utf8"),
      `${name} differs from source`,
    );
  const notices = collectNotices();
  for (const [relative, contents] of Object.entries(notices.files))
    assert(
      fs.readFileSync(path.join(dist, relative), "utf8") === contents,
      `Missing, stale, or incomplete distributed notice: ${relative}`,
    );
  console.log(
    JSON.stringify(
      {
        result: "passed",
        files: files.length,
        bytes,
        mebibytes: Number((bytes / 1024 / 1024).toFixed(3)),
        limitFiles: 2000,
        limitBytes: 20 * 1024 * 1024,
        entry: manifest.entry,
        donorCommit,
        controlledPosterHelper: reviewedPosterHelper,
        controlledRichText: reviewedRichText,
        sha256: Object.fromEntries(
          files.map((filename) => [
            path.relative(dist, filename).split(path.sep).join("/"),
            createHash("sha256")
              .update(fs.readFileSync(filename))
              .digest("hex"),
          ]),
        ),
        fontFiles: fonts.length,
        productionSourceFileCount: checkedSource.size,
        productionSourceSha256: Object.fromEntries([...checkedSource].sort().map(filename => [
          path.relative(root, filename).split(path.sep).join("/"),
          createHash("sha256").update(fs.readFileSync(filename)).digest("hex"),
        ])),
        buildInputsSha256: Object.fromEntries(["package-lock.json", "vite.config.ts", "scripts/strip-framework-loader.ts", "scripts/strip-external-features.ts"].map(relative => [
          relative, createHash("sha256").update(fs.readFileSync(path.join(root, relative))).digest("hex"),
        ])),
        referencedAssets: [...references].sort(),
        productionSourceFilesChecked: [...checkedSource]
          .map((filename) => path.relative(root, filename))
          .sort(),
        notices: {
          packages: notices.packages.length,
          missingLicenseFiles: notices.missingLicenseFiles,
          supplementalLicenseFiles: notices.supplementalLicenseFiles,
          licenseGaps: notices.licenseGaps,
        },
        redistributionStatus: notices.licenseGaps.length
          ? "Unresolved license/attribution gaps; technical checks do not establish redistribution permission."
          : "No declared license gaps detected; not a legal opinion.",
        verification:
          "Local artifact and reachable production source only. Static checks are not runtime network interception, live publication, or browser acceptance.",
      },
      null,
      2,
    ),
  );
}
