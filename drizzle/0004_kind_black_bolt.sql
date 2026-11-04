ALTER TABLE "cycle_rules" ALTER COLUMN "model_id" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "cycle_rules_cycle_model_key_idx" ON "cycle_rules" USING btree ("cycle","model_id","key");--> statement-breakpoint
ALTER TABLE "models" DROP COLUMN "lot_min";--> statement-breakpoint
ALTER TABLE "models" DROP COLUMN "lot_multiple";--> statement-breakpoint
ALTER TABLE "models" DROP COLUMN "lifecycle";