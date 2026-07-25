ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "bedrooms" integer;--> statement-breakpoint
ALTER TABLE "property_listings" ADD COLUMN IF NOT EXISTS "min_lease_months" integer;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "properties" ADD CONSTRAINT "properties_bedrooms_check" CHECK ("properties"."bedrooms" is null or "properties"."bedrooms" > 0);
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "property_listings" ADD CONSTRAINT "property_listings_min_lease_check" CHECK ("property_listings"."min_lease_months" is null or "property_listings"."min_lease_months" > 0);
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
