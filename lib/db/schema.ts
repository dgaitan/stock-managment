import {
  pgTable,
  serial,
  text,
  integer,
  numeric,
  boolean,
  date,
  timestamp,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// --- Catalogo canonico ---

export const models = pgTable("models", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  unitCost: numeric("unit_cost", { precision: 12, scale: 2 }).notNull(),
  marginPct: numeric("margin_pct", { precision: 5, scale: 4 }).notNull(),
  monthlyFinCost: numeric("monthly_fin_cost", { precision: 10, scale: 2 }).notNull(),
});

export const modelAliases = pgTable(
  "model_aliases",
  {
    id: serial("id").primaryKey(),
    alias: text("alias").notNull(),
    modelId: integer("model_id").references(() => models.id),
    source: text("source", { enum: ["rule", "ai", "user"] }).notNull(),
    confirmed: boolean("confirmed").notNull().default(false),
  },
  (t) => [uniqueIndex("model_aliases_alias_idx").on(t.alias)],
);

export const branches = pgTable("branches", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
});

export const customerTypes = pgTable("customer_types", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
});

export const lossReasons = pgTable("loss_reasons", {
  id: serial("id").primaryKey(),
  category: text("category", {
    enum: ["stock", "price", "financing", "competitor", "postponed", "no_followup"],
  }).notNull(),
});

export const lossReasonAliases = pgTable(
  "loss_reason_aliases",
  {
    id: serial("id").primaryKey(),
    rawText: text("raw_text").notNull(),
    reasonId: integer("reason_id").references(() => lossReasons.id),
    source: text("source", { enum: ["rule", "ai", "user"] }).notNull(),
    confirmed: boolean("confirmed").notNull().default(false),
  },
  (t) => [uniqueIndex("loss_reason_aliases_raw_idx").on(t.rawText)],
);

// --- Hechos normalizados ---
//
// Cada hecho tiene una clave de negocio estable (business_key, o external_id en
// leads) y un line_hash con el contenido de la fila. Al reimportar: clave nueva
// -> se inserta; misma clave con otro line_hash -> se actualiza (p. ej. un lead
// que cambia de resultado o un pedido que cambia de ETA); mismo line_hash -> no
// se toca. Así reimportar no duplica ni pierde cambios.

export const sales = pgTable(
  "sales",
  {
    id: serial("id").primaryKey(),
    invoice: text("invoice").notNull(),
    businessKey: text("business_key").notNull(),
    lineHash: text("line_hash").notNull(),
    date: date("date").notNull(),
    branchId: integer("branch_id").references(() => branches.id),
    customerType: text("customer_type"),
    customer: text("customer"),
    modelId: integer("model_id").references(() => models.id),
    version: text("version"),
    color: text("color"),
    units: integer("units").notNull(),
    unitPrice: numeric("unit_price", { precision: 12, scale: 2 }),
    isCreditNote: boolean("is_credit_note").notNull().default(false),
    isFleetOutlier: boolean("is_fleet_outlier").notNull().default(false),
  },
  (t) => [uniqueIndex("sales_business_key_idx").on(t.businessKey)],
);

export const inventorySnapshots = pgTable("inventory_snapshots", {
  id: serial("id").primaryKey(),
  monthEnd: date("month_end").notNull(),
  modelId: integer("model_id").references(() => models.id),
  version: text("version"),
  color: text("color"),
  units: integer("units").notNull(),
  avgAgeDays: integer("avg_age_days"),
});

export const leads = pgTable(
  "leads",
  {
    id: serial("id").primaryKey(),
    externalId: text("external_id").notNull(),
    lineHash: text("line_hash").notNull(),
    createdAt: date("created_at"),
    closedAt: date("closed_at"),
    modelId: integer("model_id").references(() => models.id),
    units: integer("units").notNull().default(1),
    result: text("result"),
    reasonId: integer("reason_id").references(() => lossReasons.id),
    boughtModelId: integer("bought_model_id").references(() => models.id),
  },
  (t) => [uniqueIndex("leads_external_id_idx").on(t.externalId)],
);

export const factoryOrders = pgTable(
  "factory_orders",
  {
    id: serial("id").primaryKey(),
    orderNo: text("order_no").notNull(),
    businessKey: text("business_key").notNull(),
    lineHash: text("line_hash").notNull(),
    orderDate: date("order_date"),
    modelId: integer("model_id").references(() => models.id),
    version: text("version"),
    color: text("color"),
    units: integer("units").notNull(),
    eta: date("eta"),
    status: text("status"),
    receivedAt: date("received_at"),
  },
  (t) => [uniqueIndex("factory_orders_business_key_idx").on(t.businessKey)],
);

// Comunicados: CRUD propio. La importación solo agrega los que no existen
// (por fecha y asunto); nunca borra ni sobrescribe los editados por el usuario.
// scope "cycle" = la regla vale solo para la ventana `cycle` (p. ej. "2026-10").
export const bulletins = pgTable(
  "bulletins",
  {
    id: serial("id").primaryKey(),
    date: date("date").notNull(),
    issuer: text("issuer"),
    subject: text("subject").notNull(),
    body: text("body"),
    source: text("source", { enum: ["excel", "user"] }).notNull().default("excel"),
    scope: text("scope", { enum: ["permanent", "cycle"] }).notNull().default("permanent"),
    cycle: text("cycle"),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("bulletins_date_subject_idx").on(t.date, t.subject)],
);

// Reglas por modelo (lotes, RAV4) de los comunicados vigentes. cycle = "permanent"
// o la ventana ("2026-10"). Única fuente de lotes y ciclo de vida: ver lib/engine/rules.ts.
export const cycleRules = pgTable(
  "cycle_rules",
  {
    id: serial("id").primaryKey(),
    cycle: text("cycle").notNull(),
    modelId: integer("model_id")
      .notNull()
      .references(() => models.id),
    key: text("key").notNull(),
    value: text("value").notNull(),
    source: text("source", { enum: ["bulletin", "user"] }).notNull(),
  },
  (t) => [uniqueIndex("cycle_rules_cycle_model_key_idx").on(t.cycle, t.modelId, t.key)],
);

// --- Importaciones y corridas de pedido ---

export const imports = pgTable("imports", {
  id: serial("id").primaryKey(),
  filename: text("filename").notNull(),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
  status: text("status").notNull(),
  fileSha256: text("file_sha256"),
  cutoffDate: date("cutoff_date"),
  statsJson: jsonb("stats_json"),
});

// Cada cálculo es un análisis versionado; la tabla de la app muestra el más
// reciente. params_json guarda las reglas y consideraciones aplicadas.
export const orderRuns = pgTable("order_runs", {
  id: serial("id").primaryKey(),
  version: integer("version").notNull().unique(),
  importId: integer("import_id").references(() => imports.id),
  cutoffDate: date("cutoff_date").notNull(),
  window: text("window").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  paramsJson: jsonb("params_json"),
  narrative: text("narrative"),
});

export const orderLines = pgTable("order_lines", {
  id: serial("id").primaryKey(),
  runId: integer("run_id").references(() => orderRuns.id),
  modelId: integer("model_id").references(() => models.id),
  forecastMonthly: numeric("forecast_monthly", { precision: 10, scale: 2 }),
  projectedStock: integer("projected_stock"),
  need: integer("need"),
  orderUnits: integer("order_units").notNull(),
  capital: numeric("capital", { precision: 14, scale: 2 }),
  flagsJson: jsonb("flags_json"),
  explanation: text("explanation"),
});
