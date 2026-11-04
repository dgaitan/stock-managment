DROP INDEX "factory_orders_line_hash_idx";--> statement-breakpoint
DROP INDEX "sales_line_hash_idx";--> statement-breakpoint
ALTER TABLE "bulletins" ALTER COLUMN "subject" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "bulletins" ADD COLUMN "source" text DEFAULT 'excel' NOT NULL;--> statement-breakpoint
ALTER TABLE "bulletins" ADD COLUMN "scope" text DEFAULT 'permanent' NOT NULL;--> statement-breakpoint
ALTER TABLE "bulletins" ADD COLUMN "cycle" text;--> statement-breakpoint
ALTER TABLE "bulletins" ADD COLUMN "archived_at" timestamp;--> statement-breakpoint
ALTER TABLE "bulletins" ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "bulletins" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "factory_orders" ADD COLUMN "business_key" text NOT NULL;--> statement-breakpoint
ALTER TABLE "imports" ADD COLUMN "file_sha256" text;--> statement-breakpoint
ALTER TABLE "imports" ADD COLUMN "cutoff_date" date;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "line_hash" text NOT NULL;--> statement-breakpoint
ALTER TABLE "order_runs" ADD COLUMN "version" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "order_runs" ADD COLUMN "import_id" integer;--> statement-breakpoint
ALTER TABLE "order_runs" ADD COLUMN "narrative" text;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "business_key" text NOT NULL;--> statement-breakpoint
ALTER TABLE "order_runs" ADD CONSTRAINT "order_runs_import_id_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."imports"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bulletins_date_subject_idx" ON "bulletins" USING btree ("date","subject");--> statement-breakpoint
CREATE UNIQUE INDEX "factory_orders_business_key_idx" ON "factory_orders" USING btree ("business_key");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_business_key_idx" ON "sales" USING btree ("business_key");--> statement-breakpoint
ALTER TABLE "order_runs" ADD CONSTRAINT "order_runs_version_unique" UNIQUE("version");