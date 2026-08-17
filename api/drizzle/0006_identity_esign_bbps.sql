CREATE TABLE IF NOT EXISTS "aadhaar_otp_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid,
	"tenant_user_id" uuid,
	"owner_id" uuid,
	"number_masked" text NOT NULL,
	"number_fingerprint" text NOT NULL,
	"provider" text NOT NULL,
	"provider_client_id" text NOT NULL,
	"status" text DEFAULT 'otp_sent' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "aadhaar_otp_status_check" CHECK ("aadhaar_otp_sessions"."status" in ('otp_sent','consumed','expired','failed')),
	CONSTRAINT "aadhaar_otp_subject_check" CHECK (("aadhaar_otp_sessions"."tenant_id" is not null) <> ("aadhaar_otp_sessions"."tenant_user_id" is not null))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "esign_webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"event_id" text NOT NULL,
	"event_type" text,
	"agreement_id" uuid,
	"payload" jsonb,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_esign_webhook_events_provider_event" UNIQUE("provider","event_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "identity_verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"tenant_id" uuid,
	"tenant_user_id" uuid,
	"owner_id" uuid,
	"number_masked" text NOT NULL,
	"number_fingerprint" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"provider" text,
	"provider_ref" text,
	"verified_name" text,
	"expected_name" text,
	"name_match_score" numeric(4, 3),
	"details" jsonb,
	"error_message" text,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "identity_verifications_kind_check" CHECK ("identity_verifications"."kind" in ('pan','aadhaar')),
	CONSTRAINT "identity_verifications_status_check" CHECK ("identity_verifications"."status" in ('pending','verified','name_mismatch','not_found','failed','not_configured')),
	CONSTRAINT "identity_verifications_subject_check" CHECK (("identity_verifications"."tenant_id" is not null) <> ("identity_verifications"."tenant_user_id" is not null))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lease_agreement_signers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"agreement_id" uuid NOT NULL,
	"role" text NOT NULL,
	"sign_order" integer NOT NULL,
	"full_name" text NOT NULL,
	"email" text,
	"phone" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"sign_url" text,
	"sign_url_expires_at" timestamp with time zone,
	"notified_at" timestamp with time zone,
	"signed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_lease_agreement_signers_role" UNIQUE("agreement_id","role"),
	CONSTRAINT "lease_agreement_signers_role_check" CHECK ("lease_agreement_signers"."role" in ('landlord','tenant')),
	CONSTRAINT "lease_agreement_signers_status_check" CHECK ("lease_agreement_signers"."status" in ('pending','notified','signed','declined'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "lease_agreements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"lease_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"provider" text,
	"provider_ref" text,
	"unsigned_storage_path" text NOT NULL,
	"signed_storage_path" text,
	"content_hash" text NOT NULL,
	"terms" jsonb NOT NULL,
	"sent_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lease_agreements_status_check" CHECK ("lease_agreements"."status" in ('draft','sent','partially_signed','completed','declined','expired','failed'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "property_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"storage_path" text NOT NULL,
	"caption" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "provider_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" text NOT NULL,
	"operation" text NOT NULL,
	"subject_fingerprint" text,
	"owner_id" uuid,
	"billable" boolean DEFAULT true NOT NULL,
	"outcome" text NOT NULL,
	"http_status" integer,
	"duration_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "provider_calls_outcome_check" CHECK ("provider_calls"."outcome" in ('ok','error','timeout','blocked'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "utility_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"category" text NOT NULL,
	"biller_id" text NOT NULL,
	"biller_name" text,
	"consumer_number" text NOT NULL,
	"nickname" text,
	"active" boolean DEFAULT true NOT NULL,
	"last_fetched_at" timestamp with time zone,
	"next_fetch_after" timestamp with time zone,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"last_error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_utility_accounts_biller_consumer" UNIQUE("property_id","biller_id","consumer_number"),
	CONSTRAINT "utility_accounts_category_check" CHECK ("utility_accounts"."category" in ('electricity','water','gas','broadband','dth','mobile','maintenance','other'))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "utility_bills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"owner_id" uuid NOT NULL,
	"bill_period_key" text NOT NULL,
	"bill_number" text,
	"bill_date" date,
	"due_date" date,
	"amount_due" numeric(12, 2) NOT NULL,
	"status" text DEFAULT 'UNPAID' NOT NULL,
	"provider" text,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_alerted_at" timestamp with time zone,
	"alert_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "uq_utility_bills_account_period" UNIQUE("account_id","bill_period_key"),
	CONSTRAINT "utility_bills_status_check" CHECK ("utility_bills"."status" in ('PAID','UNPAID','UNKNOWN'))
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "aadhaar_otp_sessions" ADD CONSTRAINT "aadhaar_otp_sessions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "aadhaar_otp_sessions" ADD CONSTRAINT "aadhaar_otp_sessions_tenant_user_id_users_id_fk" FOREIGN KEY ("tenant_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "aadhaar_otp_sessions" ADD CONSTRAINT "aadhaar_otp_sessions_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "esign_webhook_events" ADD CONSTRAINT "esign_webhook_events_agreement_id_lease_agreements_id_fk" FOREIGN KEY ("agreement_id") REFERENCES "public"."lease_agreements"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "identity_verifications" ADD CONSTRAINT "identity_verifications_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "identity_verifications" ADD CONSTRAINT "identity_verifications_tenant_user_id_users_id_fk" FOREIGN KEY ("tenant_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "identity_verifications" ADD CONSTRAINT "identity_verifications_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lease_agreement_signers" ADD CONSTRAINT "lease_agreement_signers_agreement_id_lease_agreements_id_fk" FOREIGN KEY ("agreement_id") REFERENCES "public"."lease_agreements"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lease_agreements" ADD CONSTRAINT "lease_agreements_lease_id_leases_id_fk" FOREIGN KEY ("lease_id") REFERENCES "public"."leases"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "lease_agreements" ADD CONSTRAINT "lease_agreements_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "property_photos" ADD CONSTRAINT "property_photos_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "property_photos" ADD CONSTRAINT "property_photos_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "provider_calls" ADD CONSTRAINT "provider_calls_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "utility_accounts" ADD CONSTRAINT "utility_accounts_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "utility_accounts" ADD CONSTRAINT "utility_accounts_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "utility_bills" ADD CONSTRAINT "utility_bills_account_id_utility_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."utility_accounts"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "utility_bills" ADD CONSTRAINT "utility_bills_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_aadhaar_otp_tenant" ON "aadhaar_otp_sessions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_aadhaar_otp_tenant_user" ON "aadhaar_otp_sessions" USING btree ("tenant_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_aadhaar_otp_live" ON "aadhaar_otp_sessions" USING btree ("number_fingerprint","status","expires_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_esign_webhook_events_agreement" ON "esign_webhook_events" USING btree ("agreement_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_identity_verifications_tenant" ON "identity_verifications" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_identity_verifications_tenant_user" ON "identity_verifications" USING btree ("tenant_user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_identity_verifications_owner" ON "identity_verifications" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_identity_verifications_cache" ON "identity_verifications" USING btree ("kind","number_fingerprint","status","verified_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_lease_agreement_signers_agreement" ON "lease_agreement_signers" USING btree ("agreement_id","sign_order");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_lease_agreements_owner" ON "lease_agreements" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_lease_agreements_lease" ON "lease_agreements" USING btree ("lease_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_lease_agreements_live_per_lease" ON "lease_agreements" USING btree ("lease_id") WHERE "lease_agreements"."status" in ('draft','sent','partially_signed');--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "uq_lease_agreements_provider_ref" ON "lease_agreements" USING btree ("provider","provider_ref") WHERE "lease_agreements"."provider_ref" is not null;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_password_reset_user" ON "password_reset_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_property_photos_property" ON "property_photos" USING btree ("property_id","sort_order");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_property_photos_owner" ON "property_photos" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_provider_calls_quota" ON "provider_calls" USING btree ("provider","operation","billable","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_provider_calls_subject" ON "provider_calls" USING btree ("subject_fingerprint","operation","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_provider_calls_owner" ON "provider_calls" USING btree ("owner_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_utility_accounts_owner" ON "utility_accounts" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_utility_accounts_property" ON "utility_accounts" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_utility_accounts_due" ON "utility_accounts" USING btree ("active","next_fetch_after");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_utility_bills_owner" ON "utility_bills" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_utility_bills_account" ON "utility_bills" USING btree ("account_id","due_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_utility_bills_overdue" ON "utility_bills" USING btree ("status","due_date");