CREATE TABLE "branches" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "branches_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "bulletins" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"issuer" text,
	"subject" text,
	"body" text
);
--> statement-breakpoint
CREATE TABLE "customer_types" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "customer_types_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "cycle_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"cycle" text NOT NULL,
	"model_id" integer,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"source" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "factory_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"order_no" text NOT NULL,
	"line_hash" text NOT NULL,
	"order_date" date,
	"model_id" integer,
	"units" integer NOT NULL,
	"eta" date,
	"status" text,
	"received_at" date
);
--> statement-breakpoint
CREATE TABLE "imports" (
	"id" serial PRIMARY KEY NOT NULL,
	"filename" text NOT NULL,
	"uploaded_at" timestamp DEFAULT now() NOT NULL,
	"status" text NOT NULL,
	"stats_json" jsonb
);
--> statement-breakpoint
CREATE TABLE "inventory_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"month_end" date NOT NULL,
	"model_id" integer,
	"version" text,
	"color" text,
	"units" integer NOT NULL,
	"avg_age_days" integer
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" serial PRIMARY KEY NOT NULL,
	"external_id" text NOT NULL,
	"created_at" date,
	"closed_at" date,
	"model_id" integer,
	"units" integer DEFAULT 1 NOT NULL,
	"result" text,
	"reason_id" integer,
	"bought_model_id" integer
);
--> statement-breakpoint
CREATE TABLE "loss_reason_aliases" (
	"id" serial PRIMARY KEY NOT NULL,
	"raw_text" text NOT NULL,
	"reason_id" integer,
	"source" text NOT NULL,
	"confirmed" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loss_reasons" (
	"id" serial PRIMARY KEY NOT NULL,
	"category" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "model_aliases" (
	"id" serial PRIMARY KEY NOT NULL,
	"alias" text NOT NULL,
	"model_id" integer,
	"source" text NOT NULL,
	"confirmed" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "models" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"unit_cost" numeric(12, 2) NOT NULL,
	"margin_pct" numeric(5, 4) NOT NULL,
	"monthly_fin_cost" numeric(5, 4) NOT NULL,
	"lot_min" integer NOT NULL,
	"lot_multiple" integer NOT NULL,
	"lifecycle" text DEFAULT 'active' NOT NULL,
	CONSTRAINT "models_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "order_lines" (
	"id" serial PRIMARY KEY NOT NULL,
	"run_id" integer,
	"model_id" integer,
	"forecast_monthly" numeric(10, 2),
	"projected_stock" integer,
	"need" integer,
	"order_units" integer NOT NULL,
	"capital" numeric(14, 2),
	"flags_json" jsonb,
	"explanation" text
);
--> statement-breakpoint
CREATE TABLE "order_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"cutoff_date" date NOT NULL,
	"window" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"params_json" jsonb
);
--> statement-breakpoint
CREATE TABLE "sales" (
	"id" serial PRIMARY KEY NOT NULL,
	"invoice" text NOT NULL,
	"line_hash" text NOT NULL,
	"date" date NOT NULL,
	"branch_id" integer,
	"customer_type" text,
	"customer" text,
	"model_id" integer,
	"version" text,
	"color" text,
	"units" integer NOT NULL,
	"unit_price" numeric(12, 2),
	"is_credit_note" boolean DEFAULT false NOT NULL,
	"is_fleet_outlier" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cycle_rules" ADD CONSTRAINT "cycle_rules_model_id_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "factory_orders" ADD CONSTRAINT "factory_orders_model_id_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_snapshots" ADD CONSTRAINT "inventory_snapshots_model_id_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_model_id_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_reason_id_loss_reasons_id_fk" FOREIGN KEY ("reason_id") REFERENCES "public"."loss_reasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leads" ADD CONSTRAINT "leads_bought_model_id_models_id_fk" FOREIGN KEY ("bought_model_id") REFERENCES "public"."models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loss_reason_aliases" ADD CONSTRAINT "loss_reason_aliases_reason_id_loss_reasons_id_fk" FOREIGN KEY ("reason_id") REFERENCES "public"."loss_reasons"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "model_aliases" ADD CONSTRAINT "model_aliases_model_id_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_run_id_order_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."order_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_lines" ADD CONSTRAINT "order_lines_model_id_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_branch_id_branches_id_fk" FOREIGN KEY ("branch_id") REFERENCES "public"."branches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_model_id_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "factory_orders_line_hash_idx" ON "factory_orders" USING btree ("line_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "leads_external_id_idx" ON "leads" USING btree ("external_id");--> statement-breakpoint
CREATE UNIQUE INDEX "loss_reason_aliases_raw_idx" ON "loss_reason_aliases" USING btree ("raw_text");--> statement-breakpoint
CREATE UNIQUE INDEX "model_aliases_alias_idx" ON "model_aliases" USING btree ("alias");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_line_hash_idx" ON "sales" USING btree ("line_hash");