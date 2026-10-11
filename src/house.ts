import { connectHouseBridge } from "@agentshouse/app-bridge";
import type { DataProvider, Identifier, RaRecord } from "react-admin";
import { isAttachmentReference, posterChoices } from "./assets";
export type HouseRuntime = Awaited<ReturnType<typeof connectHouseBridge>["runtime"]>;
export type HouseRoom = Awaited<ReturnType<HouseRuntime["rooms"]>>[number];
export type MutationStatus = {
  phase: "saving" | "queued" | "error" | "idle";
  message: string;
  identifier?: string;
};
export type QueuedWrite = { outcome: "queued"; identifier: string };
type Row = RaRecord & Record<string, any>;
type Document = {
  room: string;
  path: string;
  type?: string;
  fields?: Readonly<Record<string, unknown>>;
  markdown?: string;
};
type Snapshot = {
  room: string;
  path: string;
  type: string;
  fields: Readonly<Record<string, unknown>>;
  markdown?: string;
};
type Change = {
  path: string;
  parts: Parameters<HouseRuntime["roomDraft"]["write"]>[3];
};
type FieldKind = "string" | "number" | "boolean" | "array" | "object";
export const definitions = {
  customers: {
    type: "shop_customer",
    string:
      "id first_name last_name email address zipcode city stateAbbr birthday first_seen last_seen latest_purchase avatar",
    boolean: "has_newsletter has_ordered",
    number: "nb_orders total_spent",
    array: "groups",
    required: "id first_name last_name email first_seen last_seen",
  },
  categories: { type: "shop_category", string: "id name image", required: "id name" },
  products: {
    type: "shop_product",
    string: "id category_id reference thumbnail image description",
    number: "width height price stock sales",
    required: "id category_id reference width height price stock",
  },
  orders: {
    type: "shop_order",
    string: "id reference date customer_id status",
    number: "total_ex_taxes delivery_fees tax_rate taxes total",
    boolean: "returned",
    array: "basket",
    required:
      "id reference date customer_id status basket total_ex_taxes delivery_fees tax_rate taxes total",
  },
  invoices: {
    type: "shop_invoice",
    string: "id date order_id customer_id",
    number: "total_ex_taxes delivery_fees tax_rate taxes total",
    required: "id date order_id customer_id total",
  },
  reviews: {
    type: "shop_review",
    string: "id date status order_id product_id customer_id comment",
    number: "rating",
    required: "id date status product_id customer_id rating comment",
  },
} as const;
export type ShopResource = keyof typeof definitions;
type Database = Record<ShopResource, Row[]>;
const resources = Object.keys(definitions) as ShopResource[];
const kinds: FieldKind[] = ["string", "number", "boolean", "array", "object"];
const computed = new Set(["_house"]);
const definition = (resource: ShopResource) =>
  definitions[resource] as { type: string; required: string } & Partial<
    Record<FieldKind, string>
  >;
const fieldsFor = (resource: ShopResource) =>
  Object.fromEntries(
    kinds.flatMap((kind) =>
      (definition(resource)[kind]?.split(" ") ?? []).map((key) => [key, kind]),
    ),
  ) as Record<string, FieldKind>;
function canonicalResource(resource: string): ShopResource {
  if (!resources.includes(resource as ShopResource))
    throw new Error(`Unsupported Shop resource: ${resource}.`);
  return resource as ShopResource;
}
const equal = (a: unknown, b: unknown) =>
  JSON.stringify(a) === JSON.stringify(b);
const idEqual = (a: unknown, b: unknown) =>
  a != null && b != null && String(a) === String(b);
const empty = (value: unknown) => value == null || value === "";
function validId(value: unknown): string {
  if (
    (typeof value !== "string" && typeof value !== "number") ||
    !/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(String(value))
  )
    throw new Error(
      "Shop IDs must contain only letters, numbers, underscores, and hyphens.",
    );
  return String(value);
}
let connection: Promise<HouseRuntime> | undefined;
export function houseRuntime(): Promise<HouseRuntime> {
  connection ??= (async () => {
    const bridge = connectHouseBridge();
    bridge.setTab({ title: "Shop admin" });
    return bridge.runtime;
  })().catch((error: unknown) => {
    connection = undefined;
    throw error;
  });
  return connection;
}
export const shopQuery = {
  types: resources.map((resource) => definitions[resource].type),
  select: { fields: "all" as const, markdown: true as const },
  orderBy: [{ by: "path" as const, direction: "asc" as const }],
};
export const listRooms = (md: HouseRuntime) => md.rooms();
export const observeShop = (md: HouseRuntime, room: string) =>
  md.observe("query", { ...shopQuery, rooms: [room] });
export const observeRooms = (md: HouseRuntime) => md.observe("rooms");
export const observeSyncStatus = (md: HouseRuntime) =>
  md.observe("sync-status");
export const observeRoomDrafts = (md: HouseRuntime) =>
  md.observe("room-drafts");
export const observeStorageLoss = (md: HouseRuntime) =>
  md.observe("storage-loss");
export const observeConnectionRefusal = (md: HouseRuntime) =>
  md.observe("connection-refusal");
export const observeServiceMode = (md: HouseRuntime) =>
  md.observe("service-mode");
export const observeQueue = (md: HouseRuntime, room: string) =>
  md.observe("queue", room);

export class HouseWriteError extends Error {
  readonly details: unknown;
  constructor(message: string, details: unknown = null) {
    super(message, { cause: details });
    this.name = "HouseWriteError";
    this.details = details;
  }
}
function refused(message: string, details: unknown = null): never {
  throw new HouseWriteError(message, details);
}
export type AttachmentRead = { blob: Blob | null; name: string; type: string | null; status: "available" | "not_saved" | "unavailable" };
function attachmentRef(value: unknown): string {
  if (!isAttachmentReference(value)) refused("Expected a House at_ attachment reference for this Room.");
  return value;
}
async function attachmentDigest(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}
function actionValue(
  action: string,
  response: Awaited<ReturnType<HouseRuntime["call"]>>,
): unknown {
  if (!response || response.kind !== "action") {
    const detail = JSON.stringify(response) ?? String(response);
    refused(`House ${action} did not complete: ${detail}`, response);
  }
  return response.result;
}
type AttachmentRecord = {
  original: unknown;
  version: string;
  attachment: string;
  name: string;
  bytes: number;
  sha256: string;
  media_type: string | null;
  save: { status: "pending" | "saved" | "failed"; failure: string | null };
  storage: { provider: "house" | "connected"; scope: string };
  read?: { status: AttachmentRead["status"] };
  blob?: Blob;
};
function objectResult(value: unknown, label: string): Record<string, unknown> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    value instanceof Blob
  )
    refused(`Unsupported ${label} result shape.`, value);
  return value as Record<string, unknown>;
}
function exactKeys(
  value: Record<string, unknown>,
  allowed: string[],
  required: string[],
  label: string,
) {
  if (
    Object.keys(value).some((key) => !allowed.includes(key)) ||
    required.some((key) => !Object.hasOwn(value, key))
  )
    refused(`Unsupported ${label} result keys.`, value);
}
function attachmentRecord(
  value: unknown,
  room: string,
  allowRead: boolean,
): AttachmentRecord {
  const record = objectResult(value, "attachment");

  const required = [
    "original",
    "version",
    "attachment",
    "name",
    "bytes",
    "sha256",
    "media_type",
    "save",
    "storage",
  ];
  exactKeys(
    record,
    [...required, ...(allowRead ? ["read", "blob"] : [])],
    required,
    "attachment",
  );
  attachmentRef(record.attachment);
  if (
    typeof record.version !== "string" ||
    !record.version ||
    typeof record.name !== "string" ||
    !record.name ||
    typeof record.bytes !== "number" ||
    !Number.isSafeInteger(record.bytes) ||
    record.bytes < 0 ||
    typeof record.sha256 !== "string" ||
    !/^[a-f0-9]{64}$/.test(record.sha256) ||
    (record.media_type !== null && typeof record.media_type !== "string")
  )
    refused("Unsupported attachment metadata shape.", record);
  const save = objectResult(record.save, "attachment save");
  exactKeys(
    save,
    ["status", "failure"],
    ["status", "failure"],
    "attachment save",
  );
  if (
    !["pending", "saved", "failed"].includes(String(save.status)) ||
    (save.failure !== null && typeof save.failure !== "string")
  )
    refused("Unsupported attachment save state.", record);
  if (save.status === "failed")
    refused(
      `House attachment save failed: ${JSON.stringify(save.failure)}`,
      record,
    );
  const storage = objectResult(record.storage, "attachment storage");
  exactKeys(
    storage,
    ["provider", "scope"],
    ["provider", "scope"],
    "attachment storage",
  );
  if (
    !["house", "connected"].includes(String(storage.provider)) ||
    storage.scope !== room
  )
    refused("This attachment is not bound to the selected House Room.", record);
  if (record.read !== undefined) {
    const read = objectResult(record.read, "attachment read");
    exactKeys(read, ["status"], ["status"], "attachment read");
    if (
      !["available", "not_saved", "unavailable"].includes(String(read.status))
    )
      refused("Unsupported attachment read state.", record);
  }
  if (record.blob !== undefined && !(record.blob instanceof Blob))
    refused(
      "Unsupported attachment bytes; Runtime must return a Blob.",
      record,
    );
  return record as unknown as AttachmentRecord;
}
const storedKey = (_resource: ShopResource, key: string) => key;
function storedValue(kind: FieldKind, value: unknown): unknown {
  // MD Model optional fields may be absent, but typed YAML null is invalid.
  if (value == null) {
    if (kind === "string") return "";
    if (kind === "array" || kind === "object") return "null";
    return refused(
      "Clearing a numeric or boolean field is not supported by this Room model.",
    );
  }
  if (kind === "boolean") return String(value);
  if (kind === "array" || kind === "object") return JSON.stringify(value);
  return value;
}
function validate(resource: ShopResource, input: Row): Row {
  const fields = fieldsFor(resource);
  const row: Row = { id: validId(input.id) };
  for (const [key, value] of Object.entries(input)) {
    if (computed.has(key) || value === undefined || key === "id") continue;
    const kind = fields[key];
    if (!kind) refused(`Unsupported ${resource} field: ${key}.`);
    if (value === null) {
      if (kind === "string") {
        row[key] = "";
        continue;
      }
      refused(`Cannot clear ${key}.`);
    }
    if (key.endsWith("_id")) {
      row[key] = empty(value) ? "" : validId(value);
      continue;
    }
    if (
      kind === "array"
        ? !Array.isArray(value)
        : kind === "object"
          ? typeof value !== "object" || Array.isArray(value)
          : typeof value !== kind
    )
      refused(`Invalid ${key}: expected ${kind}.`);
    if (kind === "number" && (!Number.isFinite(value) || value < 0))
      refused(`${key} must be a non-negative finite number.`);
    row[key] = value;
  }
  for (const key of definition(resource).required.split(" "))
    if (empty(row[key])) refused(`${key} is required.`);
  for (const key of [
    "date",
    "birthday",
    "first_seen",
    "last_seen",
    "latest_purchase",
  ])
    if (row[key] && !Number.isFinite(Date.parse(row[key])))
      refused(`${key} must be a valid date.`);
  for (const key of resource === "customers" ? ["avatar"] : resource === "categories" ? ["image"] : [])
    if (row[key] && !isAttachmentReference(row[key]))
      refused("Images must use a House Room attachment reference.");
  if (resource === "products") {
    for (const key of ["image", "thumbnail"])
      if (row[key] && !isAttachmentReference(row[key]) && !/^\/posters\/(0[1-9]|1[0-2])\.svg$/.test(row[key]))
        refused("Choose a Room attachment reference or bundled product artwork.");
    for (const key of ["stock", "sales"])
      if (row[key] != null && !Number.isInteger(row[key]))
        refused(`${key} must be an integer.`);
  }
  if (
    resource === "customers" &&
    row.groups?.some((v: unknown) => typeof v !== "string")
  )
    refused("Customer segments must be strings.");
  if (
    (resource === "orders" || resource === "invoices") &&
    row.tax_rate != null &&
    row.tax_rate > 1
  )
    refused("Tax rate must be a fraction between 0 and 1.");
  if (resource === "orders") {
    if (!["ordered", "delivered", "cancelled"].includes(row.status))
      refused("Invalid order status.");
    if (!row.basket.length) refused("An order requires at least one item.");
    row.basket = row.basket.map((item: Record<string, unknown>) => {
      if (
        !item ||
        Object.keys(item).some(
          (key) => !["product_id", "quantity"].includes(key),
        ) ||
        !Number.isSafeInteger(item.quantity) ||
        Number(item.quantity) <= 0
      )
        refused(
          "Basket items require a product and positive integer quantity.",
        );
      return { product_id: validId(item.product_id), quantity: item.quantity };
    });
  }
  if (resource === "reviews") {
    if (!["accepted", "pending", "rejected"].includes(row.status))
      refused("Invalid review status.");
    if (!Number.isInteger(row.rating) || row.rating < 1 || row.rating > 5)
      refused("Review rating must be between 1 and 5.");
  }
  return row;
}
function encode(resource: ShopResource, row: Row): Record<string, unknown> {
  const fields = fieldsFor(resource);
  return Object.fromEntries(
    Object.entries(validate(resource, row))
      .filter(([, value]) => value != null)
      .map(([key, value]) => [
        storedKey(resource, key),
        storedValue(fields[key], value),
      ]),
  );
}
export function readShop(
  result: { documents: readonly Document[] },
  room: string,
): Database {
  const db = Object.fromEntries(
    resources.map((resource) => [resource, []]),
  ) as unknown as Database;
  const seen = new Set<string>();
  for (const document of result.documents) {
    if (document.room !== room)
      refused("House returned a document outside the selected Room.");
    const resource = resources.find(
      (key) => definitions[key].type === document.type,
    );
    if (!resource) refused(`Unsupported Shop document at ${document.path}.`);
    const fields = { ...document.fields };
    if (Object.hasOwn(fields, "type") && fields.type !== definitions[resource].type) refused(`Mismatched ${resource} document type.`, document);
    const row: Row = { id: validId(fields.id) };
    for (const [key, kind] of Object.entries(fieldsFor(resource))) {
      const storageName = storedKey(resource, key);
      if (!Object.hasOwn(fields, storageName)) continue;
      let value = fields[storageName];
      if (value === null)
        refused(
          `Stored ${key} contains an invalid typed null. Resolve it in House.`,
          document,
        );
      if (value != null && kind === "boolean") {
        if (value !== "true" && value !== "false")
          refused(`Stored ${key} must be true or false.`, document);
        value = value === "true";
      } else if (value != null && (kind === "array" || kind === "object")) {
        if (typeof value !== "string")
          refused(`Stored ${key} must be a JSON string.`, document);
        try {
          value = JSON.parse(value);
        } catch {
          refused(`Stored ${key} contains invalid JSON.`, document);
        }
      }
      row[key] = value;
    }
    const validated = validate(resource, row);
    const key = `${resource}/${row.id}`;
    if (seen.has(key))
      refused(
        `Duplicate ${resource} ID ${row.id}. Resolve the duplicate in House.`,
      );
    seen.add(key);
    validated._house = {
      room,
      path: document.path,
      type: definitions[resource].type,
      fields,
      markdown: document.markdown,
    } satisfies Snapshot;
    db[resource].push(validated);
  }
  validateReferences(db);
  return db;
}
function validateReferences(db: Database): void {
  const exists = (resource: ShopResource, id: unknown) =>
    empty(id) || db[resource].some((row) => idEqual(row.id, id));
  for (const resource of resources)
    for (const row of db[resource]) {
      for (const [field, target] of [
        ["category_id", "categories"],
        ["customer_id", "customers"],
        ["order_id", "orders"],
        ["product_id", "products"],
      ] as const)
        if (!exists(target, row[field]))
          refused(`${resource} ${row.id} refers to missing ${target}.`);
      for (const item of row.basket ?? [])
        if (!exists("products", item.product_id))
          refused(`Order ${row.id} refers to a missing product.`);
      if (resource === "invoices" || (resource === "reviews" && row.order_id)) {
        const order = db.orders.find((order) =>
          idEqual(order.id, row.order_id),
        );
        if (order && !idEqual(order.customer_id, row.customer_id))
          refused("The order belongs to a different customer.");
        if (
          resource === "reviews" &&
          order &&
          !order.basket.some((item: any) =>
            idEqual(item.product_id, row.product_id),
          )
        )
          refused("The reviewed product is not in the selected order.");
      }
    }
}
function decorated(resource: string, db: Database): Row[] {
  const rows = db[canonicalResource(resource)];
  if (resource !== "customers") return rows;
  return rows.map((row) => {
    const orders = db.orders.filter(
      (order) =>
        idEqual(order.customer_id, row.id) && order.status !== "cancelled",
    );
    return {
      ...row,
      has_ordered: orders.length > 0,
      nb_orders: orders.length,
      total_spent: orders.reduce((n, order) => n + order.total, 0),
      latest_purchase:
        orders
          .map((order) => order.date)
          .sort()
          .at(-1) ?? "",
    };
  });
}
const fieldValue = (row: Row, key: string) =>
  key.split(".").reduce((value: any, part) => value?.[part], row);
export function matchesFilter(
  row: Row,
  filter: Record<string, unknown> = {},
): boolean {
  return Object.entries(filter).every(([key, expected]) => {
    if (expected === undefined || expected === "") return true;
    if (key === "q")
      return Object.entries(row)
        .filter(([name]) => name !== "_house")
        .some(([, value]) =>
          JSON.stringify(value)
            ?.toLowerCase()
            .includes(String(expected).toLowerCase()),
        );
    const match = key.match(/^(.*)_(gte|lte|gt|lt|neq)$/);
    const field = match?.[1] ?? key;
    const op = match?.[2] ?? "eq";
    const actual = fieldValue(row, field);
    if (op === "gte") return actual != null && actual >= expected!;
    if (op === "lte") return actual != null && actual <= expected!;
    if (op === "gt") return actual != null && actual > expected!;
    if (op === "lt") return actual != null && actual < expected!;
    const same = Array.isArray(actual)
      ? Array.isArray(expected)
        ? expected.every((value) => actual.some((item) => idEqual(item, value)))
        : actual.some((item) => idEqual(item, expected))
      : expected === null
        ? empty(actual)
        : actual != null && String(actual) === String(expected);
    return op === "neq" ? !same : same;
  });
}
function listRows(
  resource: string,
  db: Database,
  params: any,
): { data: Row[]; total: number } {
  const rows = decorated(resource, db).filter((row) =>
    matchesFilter(row, params.filter),
  );
  const { field, order } = params.sort ?? {
    field: resource === "activity_log" ? "date" : "id",
    order: resource === "activity_log" ? "DESC" : "ASC",
  };
  rows.sort((a, b) => {
    const left = fieldValue(a, field);
    const right = fieldValue(b, field);
    if (empty(left) || empty(right))
      return empty(left) === empty(right) ? 0 : empty(left) ? 1 : -1;
    const compared =
      typeof left === "number" && typeof right === "number"
        ? left - right
        : String(left).localeCompare(String(right));
    return compared * (order === "DESC" ? -1 : 1);
  });
  const { page = 1, perPage = 25 } = params.pagination ?? {};
  if (
    !Number.isInteger(page) ||
    page < 1 ||
    !Number.isInteger(perPage) ||
    perPage < 1
  )
    refused("Invalid pagination.");
  return {
    data: rows.slice((page - 1) * perPage, page * perPage),
    total: rows.length,
  };
}
function snapshot(row: Row, resource: ShopResource, room: string): Snapshot {
  const opened = row?._house as Snapshot | undefined;
  if (
    !opened ||
    opened.room !== room ||
    opened.type !== definitions[resource].type ||
    !idEqual(opened.fields.id, row.id)
  )
    refused(
      "This item has no matching opened House snapshot. Reload it before editing.",
    );
  return opened;
}
function currentMember(
  db: Database,
  resource: ShopResource,
  row: Row,
  room: string,
): Row {
  const opened = snapshot(row, resource, room);
  const current = db[resource].find((item) => idEqual(item.id, row.id));
  if (!current || current._house.path !== opened.path)
    refused("This item moved or was deleted. Reload before editing.");
  return current;
}
function fieldChange(
  resource: ShopResource,
  row: Row,
  patch: Row,
  room: string,
): Change | null {
  const opened = snapshot(row, resource, room);
  const kinds = fieldsFor(resource);
  const validated = validate(resource, { ...row, ...patch });
  const openedValues = validate(resource, row);
  const fields: Record<
    string,
    { value: unknown; base: { value: unknown } | null }
  > = {};
  for (const key of Object.keys(patch)) {
    if (key === "id" || computed.has(key) || patch[key] === undefined) continue;
    // Different JSON whitespace is not a user edit. Keep the original stored bytes
    // solely as the concurrency base for values that actually changed.
    if (
      Object.hasOwn(openedValues, key) &&
      equal(openedValues[key], validated[key])
    )
      continue;
    const storageName = storedKey(resource, key);
    if (!Object.hasOwn(opened.fields, storageName) && validated[key] === null)
      continue;
    const value = storedValue(kinds[key], validated[key]);
    if (
      Object.hasOwn(opened.fields, storageName) &&
      equal(opened.fields[storageName], value)
    )
      continue;
    if (!Object.hasOwn(opened.fields, storageName) && value === null) continue;
    fields[storageName] = {
      value,
      base: Object.hasOwn(opened.fields, storageName)
        ? { value: opened.fields[storageName] }
        : null,
    };
  }
  return Object.keys(fields).length
    ? { path: opened.path, parts: { fields } }
    : null;
}
/** Validate the delta that will actually be queued, not untouched stale form values. */
function effectiveChange(
  resource: ShopResource,
  current: Row,
  change: Change | null,
): Row {
  const next = { ...current };
  const kinds = fieldsFor(resource);
  for (const [key, part] of Object.entries(change?.parts.fields ?? {})) {
    const value = part.value;
    next[key] =
      kinds[key] === "boolean"
        ? value === "true"
        : kinds[key] === "array" || kinds[key] === "object"
          ? JSON.parse(value as string)
          : value;
  }
  return validate(resource, next);
}
function removal(
  resource: ShopResource,
  opened: Row,
  current: Row,
  room: string,
): Change {
  const before = snapshot(opened, resource, room);
  const after = snapshot(current, resource, room);
  if (
    typeof before.markdown !== "string" ||
    before.markdown !== after.markdown ||
    !equal(before.fields, after.fields)
  )
    refused(
      "This item changed since you opened it. Reload and review before deleting.",
    );
  return { path: before.path, parts: { removal: { base: before.markdown } } };
}
async function queueChanges(
  md: HouseRuntime,
  room: string,
  changes: (Change | null)[],
  assertAvailable: () => void = () => {},
  owned: Record<string, string> = {},
): Promise<QueuedWrite | null> {
  const active = changes.filter((change): change is Change => change !== null);
  if (!active.length) return null;
  if (new Set(active.map((change) => change.path)).size !== active.length)
    refused("A grouped save contains the same document twice.");
  for (const change of active) {
    assertAvailable();
    const draft = await md.roomDraft.read(room, change.path);
    if (draft && (!Object.hasOwn(owned, change.path) || owned[change.path] !== draft.revision || !equal(draft.parts, change.parts)))
      refused(
        "This item has an unfinished House draft. Resolve it in House before editing again.",
        draft,
      );
  }
  const drafts = [];
  for (const change of active) {
    assertAvailable();
    if (Object.hasOwn(owned, change.path)) {
      const held = await md.roomDraft.read(room, change.path);
      if (!held || held.revision !== owned[change.path] || !equal(held.parts, change.parts)) refused("The shared draft changed before Save. Its current contents are kept.");
      drafts.push({path: change.path, revision: held.revision});
      continue;
    }
    const written = await md.roomDraft.write(
      room,
      change.path,
      null,
      change.parts,
    );
    if (written.outcome !== "written" || !written.roomDraft)
      refused(
        "A House draft changed in another tab. Reload and review. Any prepared drafts have been kept.",
        written,
      );
    drafts.push({ path: change.path, revision: written.roomDraft.revision });
  }
  assertAvailable();
  const saved = await md.save(room, drafts);
  if (saved.outcome !== "saved")
    refused(
      `House did not queue this change: ${saved.rule}. Drafts have been kept.`,
      saved,
    );
  return { outcome: "queued", identifier: saved.identifier };
}
const creationDefaults = (resource: ShopResource, data: Row): Row => {
    const now = new Date().toISOString();
    const shared = {
      ...data,
      id: data.id ?? `${resource}-${crypto.randomUUID()}`,
    };
    if (resource === "customers")
      return {
        first_seen: now,
        last_seen: now,
        has_newsletter: false,
        has_ordered: false,
        groups: [],
        nb_orders: 0,
        total_spent: 0,
        ...shared,
      };
    if (resource === "products")
      return {
        thumbnail: posterChoices[0].id,
        image: posterChoices[0].id,
        description: "",
        sales: 0,
        stock: 0,
        ...shared,
      };
    if (resource === "reviews")
      return { date: now, status: "pending", ...shared };
    return shared;
  };

export type ShopDataProvider = DataProvider & {
  getAttachment(reference: string): Promise<AttachmentRead>;
  openDraft(resource: string, record: Row | undefined, initial: Record<string, unknown>): Promise<ShopFormDraft>;
  setObservedSnapshot(result: unknown): void;
  getLocalResult(key: readonly unknown[], previous?: unknown): { handled: boolean; value?: unknown };
};
export function createHouseDataProvider(
  md: HouseRuntime,
  room: string,
  options: { onMutation?: (status: MutationStatus) => void; isAvailable?: () => boolean; observed?: boolean } = {},
): ShopDataProvider {
  if (!room) throw new Error("Select an attached House Room.");
  const assertAvailable = () => {
    if (options.isAvailable && !options.isAvailable())
      refused("The data binding is not ready. Your open edits and House drafts are kept.");
  };
  const openedRows = new Map<string, Row>();
  let mutations: Promise<unknown> = Promise.resolve();
  let observedDb: Database | undefined;
  const fetchDb = async () => {
    assertAvailable();
    if (options.observed) {
      if (!observedDb) refused("The initial House snapshot is still loading.");
      return structuredClone(observedDb);
    }
    const result = await md.query({ ...shopQuery, rooms: [room] });
    assertAvailable();
    return readShop(result, room);
  };
  const remember = (resource: string, rows: Row[]) => {
    for (const row of rows)
      openedRows.set(
        `${canonicalResource(resource)}/${row.id}`,
        structuredClone(row),
      );
    return rows;
  };
  const notify = (status: MutationStatus) => options.onMutation?.(status);
  const getAttachment = async (reference: string): Promise<AttachmentRead> => {
    assertAvailable();
    const attachment_ref = attachmentRef(reference);
    const result = actionValue(
      "attachments/get",
      await md.call("attachments/get", { room_ref: room, attachment_ref }),
    );
    const record = attachmentRecord(result, room, true);
    if (record.attachment !== attachment_ref)
      refused("House returned a different attachment reference.", result);
    const blob = record.blob ?? null;
    if (blob && blob.size !== record.bytes)
      refused(
        "House attachment byte length does not match its metadata.",
        result,
      );
    if (blob && (await attachmentDigest(blob)) !== record.sha256)
      refused("House attachment SHA-256 does not match its metadata.", result);
    if (record.read?.status === "available" && !blob)
      refused(
        "House reported an available attachment without Blob bytes.",
        result,
      );
    if (blob && record.read && record.read.status !== "available")
      refused(
        "House returned attachment bytes with an incompatible read status.",
        result,
      );
    assertAvailable();
    return {
      blob,
      name: record.name,
      type: record.media_type,
      status: blob ? "available" : (record.read?.status ?? "unavailable"),
    };
  };

  const mutation = <T>(
    operation: (
      save: (changes: (Change | null)[], owned?: Record<string, string>) => Promise<void>,
    ) => Promise<T>,
  ): Promise<T> => {
    const run = async () => {
      notify({ phase: "saving", message: "Preparing House change…" });
      let mode: Awaited<ReturnType<typeof observeServiceMode>> | undefined;
      try {
        assertAvailable();
        mode = await observeServiceMode(md);
        assertAvailable();
        let queued = false;
        const result = await operation(async (changes, owned) => {
          const references = changes.flatMap(change => {
            const creation = change?.parts.creation;
            const fields = (creation && "fields" in creation ? creation.fields : undefined) ?? Object.fromEntries(Object.entries(change?.parts.fields ?? {}).map(([key, part]) => [key, part.value]));
            return ["image", "thumbnail", "avatar"].map(key => fields[key]).filter(isAttachmentReference);
          });
          if (references.length) {
            // Rooms is a detached local snapshot. Save must never fetch image bytes or call an Action.
            const selected = (await md.rooms()).find(value => value.locator === room);
            assertAvailable();
            if (!selected) refused("The selected Room metadata is unavailable. Its draft is kept.");
            for (const reference of references) {
              const metadata = selected.attachments.find(value => value.reference === reference);
              if (!metadata) refused("The image reference is not declared in the selected Room. Its draft is kept.");
            }
          }
          const receipt = await queueChanges(md, room, changes, assertAvailable, owned);
          if (receipt) {
            queued = true;
            notify({
              phase: "queued",
              message: "Queued in House. Waiting for synchronization.",
              identifier: receipt.identifier,
            });
          }
        });
        if (!queued) notify({ phase: "idle", message: "No changes needed." });
        return result;
      } catch (error) {
        notify({
          phase: "error",
          message:
            error instanceof Error
              ? error.message
              : "House could not save this change.",
        });
        throw error;
      } finally {
        mode?.close();
      }
    };
    const result = mutations.then(run, run);
    mutations = result.catch(() => undefined);
    return result;
  };
  const openedFor = (
    resource: ShopResource,
    id: Identifier,
    previous?: Row,
  ) => {
    const row =
      previous ??
      openedRows.get(`${resource}/${id}`) ??
      refused("Open this record before changing it.");
    if (!idEqual(row.id, id))
      refused("Opened snapshot belongs to another record.");
    return row;
  };
  const provider = {
    openDraft(resource: string, record: Row | undefined, initial: Record<string, unknown>) {
      assertAvailable();
      return openBusinessDraft(md, room, canonicalResource(resource), record, initial, fetchDb);
    },
    setObservedSnapshot(result: unknown) {
      if (!result || typeof result !== "object" || !("documents" in result) || !Array.isArray(result.documents)) refused("House returned an invalid observed document snapshot.");
      observedDb = readShop(result as Parameters<typeof readShop>[0], room);
    },
    getLocalResult(key: readonly unknown[], previous?: unknown): { handled: boolean; value?: unknown } {
      const [resource, method, raw] = key;
      if (!observedDb || typeof resource !== "string" || typeof method !== "string" || !["getList", "getOne", "getMany", "getManyReference", "getInfiniteList"].includes(method)) return { handled: false };
      assertAvailable();
      const params = (raw ?? {}) as any;
      if (method === "getOne") {
        const data = decorated(resource, observedDb).find(row => idEqual(row.id, params.id));
        if (!data) throw Object.assign(new Error(`${resource} record was not found in this Room.`), { status: 404 });
        remember(resource, [data]);
        
        return { handled: true, value: data };
      }
      if (method === "getMany") {
        const data = decorated(resource, observedDb).filter(row => (params.ids ?? []).some((id: Identifier) => idEqual(row.id, id)));
        remember(resource, data); return { handled: true, value: data };
      }
      if (method === "getInfiniteList") {
        const existing = previous as { pageParams?: unknown[] } | undefined;
        const pageParams = existing?.pageParams?.length ? existing.pageParams : [params.pagination?.page ?? 1];
        const pages = pageParams.map(page => { const result = listRows(resource, observedDb!, { ...params, pagination: { ...params.pagination, page } }); remember(resource, result.data); return { ...result, pageParam: page }; });
        return { handled: true, value: { pages, pageParams } };
      }
      const result = listRows(resource, observedDb, method === "getManyReference" ? { ...params, filter: { ...params.filter, [params.target]: params.id } } : params);
      remember(resource, result.data); return { handled: true, value: result };
    },
    getAttachment,
    async getList(resource: string, params: any) {
      const result = listRows(resource, await fetchDb(), params);
      remember(resource, result.data);
      return result;
    },
    async getOne(resource: string, params: any) {
      const data = decorated(resource, await fetchDb()).find((row) =>
        idEqual(row.id, params.id),
      );
      if (!data)
        throw Object.assign(
          new Error(`${resource} record was not found in this Room.`),
          { status: 404 },
        );
      remember(resource, [data]);

      return { data };
    },
    async getMany(resource: string, params: any) {
      const data = decorated(resource, await fetchDb()).filter((row) =>
        params.ids.some((id: Identifier) => idEqual(row.id, id)),
      );
      remember(resource, data);
      return { data };
    },
    async getManyReference(resource: string, params: any) {
      return provider.getList(resource, {
        ...params,
        filter: { ...params.filter, [params.target]: params.id },
      });
    },
    create(resourceName: string, params: any) {
      return mutation(async (save) => {
        const resource = canonicalResource(resourceName);
        const db = await fetchDb();
        const held = await submittedDraft(md, room, resource, params.meta?.houseDraft, "creation");
        const creation = held?.parts.creation;
        const data = validate(resource, creation && "fields" in creation ? draftValues(resource, creation.fields) as Row : creationDefaults(resource, params.data));
        if (db[resource].some((row) => idEqual(row.id, data.id)))
          refused("A Shop record with this ID already exists.");
        const fields = encode(resource, data);
        const path = `shop/${resource}/${data.id}.md`;
        db[resource].push(data);
        validateReferences(db);
        if (held && held.path !== path) refused("The draft path does not match its business record.");
        await save([{path, parts: held?.parts ?? {creation: {type: definitions[resource].type, fields, sections: {}}}}], held ? {[path]: held.revision} : {});
        return {
          data: {
            ...data,
            _house: { room, path, type: definitions[resource].type, fields },
          },
        };
      });
    },
    update(resourceName: string, params: any) {
      return mutation(async (save) => {
        const resource = canonicalResource(resourceName);
        const opened = openedFor(resource, params.id, params.previousData);
        const db = await fetchDb();
        const current = currentMember(db, resource, opened, room);
        if (
          !idEqual(opened.id, params.id) ||
          (params.data.id != null && !idEqual(params.data.id, params.id))
        )
          refused("An edit cannot change a record ID.");
        const patch = {
          ...params.data,

          id: opened.id,
        };
        const held = await submittedDraft(md, room, resource, params.meta?.houseDraft, "fields");
        if (held && held.path !== snapshot(opened, resource, room).path) refused("The draft belongs to another business record.");
        const change = held ? {path: held.path, parts: held.parts} : fieldChange(resource, opened, patch, room);
        const next = effectiveChange(resource, current, change);
        db[resource] = db[resource].map((row) =>
          idEqual(row.id, opened.id) ? next : row,
        );
        validateReferences(db);
        await save([change], held ? {[held.path]: held.revision} : {});
        return { data: { ...current, ...next } };
      });
    },
    updateMany(resourceName: string, params: any) {
      return mutation(async (save) => {
        const resource = canonicalResource(resourceName);
        if (!Array.isArray(params.ids))
          refused("Bulk edits require a list of record IDs.");
        if (new Set(params.ids.map(validId)).size !== params.ids.length)
          refused("A grouped save contains the same document twice.");
        const db = await fetchDb();
        const changes = params.ids.map((id: Identifier) => {
          const opened = openedFor(resource, id);
          const current = currentMember(db, resource, opened, room);
          if (params.data.id != null && !idEqual(params.data.id, id))
            refused("A bulk edit cannot change record IDs.");
          const change = fieldChange(
            resource,
            opened,
            { ...params.data, id },
            room,
          );
          const next = effectiveChange(resource, current, change);
          db[resource] = db[resource].map((row) =>
            idEqual(row.id, id) ? next : row,
          );
          return change;
        });
        validateReferences(db);
        await save(changes);
        return { data: params.ids };
      });
    },
    delete(resourceName: string, params: any) {
      return mutation(async (save) => {
        const resource = canonicalResource(resourceName);
        const opened = openedFor(resource, params.id, params.previousData);
        const db = await fetchDb();
        const current = currentMember(db, resource, opened, room);
        const change = removal(resource, opened, current, room);
        db[resource] = db[resource].filter(
          (row) => !idEqual(row.id, opened.id),
        );
        try {
          validateReferences(db);
        } catch {
          refused(
            "This record is still referenced. Reassign or remove its related records before deleting it.",
          );
        }
        await save([change]);
        return { data: current };
      });
    },
    deleteMany(resourceName: string, params: any) {
      return mutation(async (save) => {
        const resource = canonicalResource(resourceName);
        if (!Array.isArray(params.ids))
          refused("Bulk deletion requires a list of record IDs.");
        if (new Set(params.ids.map(validId)).size !== params.ids.length)
          refused("A grouped save contains the same document twice.");
        const db = await fetchDb();
        const changes = params.ids.map((id: Identifier) => {
          const opened = openedFor(resource, id);
          return removal(
            resource,
            opened,
            currentMember(db, resource, opened, room),
            room,
          );
        });
        db[resource] = db[resource].filter(
          (row) => !params.ids.some((id: Identifier) => idEqual(row.id, id)),
        );
        try {
          validateReferences(db);
        } catch {
          refused(
            "A selected record is still referenced. Reassign or remove its related records before deleting it.",
          );
        }
        await save(changes);
        return { data: params.ids };
      });
    },
  };
  return provider as ShopDataProvider;
}

type LocalDraft = NonNullable<Awaited<ReturnType<HouseRuntime['roomDraft']['read']>>>;
type DraftReference = {path: string; revision: string};
/** Decode a local business draft without validating incomplete input. */
function draftValues(resource: ShopResource, fields: Readonly<Record<string, unknown>>) {
  const values: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(fields)) {
    // Native fields-all includes the discriminator. Preserve it in the opened CAS
    // snapshot, validate the exact type, and omit it only from editable values.
    if (key === 'type') {
      if (value !== definitions[resource].type) refused(`Mismatched ${resource} draft type.`);
      continue;
    }
    const kind = fieldsFor(resource)[key];
    if (!kind) refused(`Unsupported ${resource} draft field: ${key}.`);
    if (kind === 'boolean' && (value === 'true' || value === 'false')) values[key] = value === 'true';
    else if ((kind === 'array' || kind === 'object') && typeof value === 'string') {
      try {values[key] = JSON.parse(value);} catch {values[key] = value;}
    } else values[key] = value;
  }
  return values;
}
function draftField(kind: FieldKind, value: unknown): unknown {
  if (kind === 'boolean' && typeof value === 'boolean') return String(value);
  if ((kind === 'array' || kind === 'object') && typeof value === 'object' && value !== null) return JSON.stringify(value);
  return value === undefined ? '' : value;
}
async function submittedDraft(md: HouseRuntime, room: string, resource: ShopResource, ref: DraftReference | undefined, kind: 'creation' | 'fields') {
  if (!ref) return null;
  if (typeof ref.path !== 'string' || typeof ref.revision !== 'string') refused('Invalid local draft reference.');
  const draft = await md.roomDraft.read(room, ref.path);
  if (!draft || draft.revision !== ref.revision) refused('The shared draft changed before Save. Its current contents are kept.');
  if (Object.keys(draft.parts).some(key => key !== kind)) refused('This draft contains other edits. It is kept for review.');
  if (kind === 'creation') {
    const creation = draft.parts.creation;
    if (!creation || !('fields' in creation) || creation.type !== definitions[resource].type || Object.keys(creation.sections).length) refused('The creation draft does not match this business form.');
  } else {
    if (!draft.parts.fields || Object.keys(draft.parts.fields).some(key => key === 'id' || !fieldsFor(resource)[key])) refused('The field draft does not match this business form.');
  }
  return draft;
}
/** One actual document draft, shared across tabs; no buffer document or content copy. */
export async function openBusinessDraft(md: HouseRuntime, room: string, resource: ShopResource, record: Row | undefined, initial: Record<string, unknown>, currentDb: () => Promise<Database>) {
  let opened = record?._house ? snapshot(record, resource, room) : undefined;
  const state = await md.presentation.read();
  const pointers = state && typeof state === 'object' && 'shopDrafts' in state ? (state as {shopDrafts: Record<string, string>}).shopDrafts : {};
  const scope = `${room}/${resource}`;
  const pointed = !opened && typeof pointers?.[scope] === 'string' ? pointers[scope] : '';
  let draft = opened || pointed ? await md.roomDraft.read(room, opened?.path ?? pointed) : null;
  if (!opened && draft && !draft.parts.creation) draft = null;
  const seeded = creationDefaults(resource, initial as Row);
  const allowed = fieldsFor(resource);
  let fields = opened ? {...opened.fields} : Object.fromEntries(Object.entries(seeded).filter(([key]) => allowed[key]).map(([key, value]) => [key, draftField(allowed[key], value)]));
  const path = opened?.path ?? draft?.path ?? `shop/${resource}/${seeded.id}.md`;
  const acceptParts = (value: LocalDraft | null) => {
    if (value?.parts.creation) {
      const creation = value.parts.creation;
      if (!('fields' in creation) || creation.type !== definitions[resource].type) refused('The draft belongs to another business form.');
      fields = {...creation.fields};
    } else if (value?.parts.fields) fields = {...(opened?.fields ?? fields), ...Object.fromEntries(Object.entries(value.parts.fields).map(([key, part]) => [key, part.value]))};
    return draftValues(resource, fields);
  };
  acceptParts(draft);
  const pending = new Map<string, unknown>();
  let serial = Promise.resolve();
  const listeners = new Set<(values: Record<string, unknown>) => void>();
  const values = () => ({...draftValues(resource, fields), ...Object.fromEntries(pending)});
  const redraw = () => {for (const listener of listeners) listener(values());};
  const observation = await md.observe('room-drafts');
  const apply = (drafts: readonly LocalDraft[]) => {
    const value = drafts.find(row => row.room === room && row.path === path);
    if (value) {draft = value; acceptParts(value); redraw();}
  };
  apply(observation.current());
  const unsubscribe = observation.subscribe(apply);
  const write = (patch: Record<string, unknown>) => {
    const keys = Object.keys(patch).filter(key => key !== 'id' && allowed[key]);
    for (const key of keys) pending.set(key, patch[key]);
    const next = serial.then(async () => {
      let latest = await md.roomDraft.read(room, path);
      if ((!latest || !latest.parts.creation) && !opened && draft) {
        const saved = (await currentDb())[resource].find(row => row._house.path === path);
        if (saved) opened = snapshot(saved, resource, room);
      }
      for (;;) {
        const input = Object.fromEntries(keys.map(key => [key, pending.has(key) ? pending.get(key) : patch[key]]));
        const encoded = Object.fromEntries(Object.entries(input).map(([key, value]) => [key, draftField(allowed[key], value)]));
        let parts: LocalDraft['parts'];
        if (opened) {
          parts = {...latest?.parts, fields: {...latest?.parts.fields, ...Object.fromEntries(Object.entries(encoded).map(([key, value]) => [key, {value, base: Object.hasOwn(opened!.fields,key) ? {value:opened!.fields[key]} : null}]))}};
        } else {
          if (latest) acceptParts(latest);
          parts = {...latest?.parts, creation: {type: definitions[resource].type, fields: {...fields, ...encoded}, sections: {}}};
        }
        const result = await md.roomDraft.write(room,path,latest?.revision ?? null,parts);
        if (result.outcome === 'stale') {latest = result.current; continue;}
        if (!result.roomDraft) refused('The local business draft is unavailable.');
        draft = result.roomDraft; acceptParts(draft);
        for (const [key, value] of Object.entries(input)) if (equal(pending.get(key), value)) pending.delete(key);
        redraw();
        if (!opened) {
          const state = await md.presentation.read();const base = state && typeof state === 'object' ? state as Record<string, unknown> : {};
          const held = base.shopDrafts && typeof base.shopDrafts === 'object' ? base.shopDrafts as Record<string,string> : {};
          await md.presentation.write({...base,shopDrafts:{...held,[scope]:path}});
        }
        return;
      }
    });
    serial = next.catch(() => undefined);return next;
  };
  return {
    values, write,
    subscribe(listener: (values: Record<string, unknown>) => void) {listeners.add(listener);return () => {listeners.delete(listener);};},
    close() {unsubscribe();observation.close();},
    async prepare() {
      await serial;
      if (pending.size) refused('The latest input has not reached its local Room Draft. It is kept in the open form. Retry editing before Save.');
      const latest = await md.roomDraft.read(room,path);
      if (latest) {draft = latest;acceptParts(latest);}
      else if (draft) {
        const saved = (await currentDb())[resource].find(row => row._house.path === path);
        if (saved) {opened = snapshot(saved,resource,room);fields = {...opened.fields};}
      }
      return {data: values(), reference: latest ? {path,revision:latest.revision} : undefined, existing: Boolean(opened), previousData: opened ? {...draftValues(resource,opened.fields),id:validId(opened.fields.id),_house:opened} : undefined};
    },
  };
}
export type ShopFormDraft = Awaited<ReturnType<typeof openBusinessDraft>>;
