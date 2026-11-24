import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_products_badges" AS ENUM('handcrafted', 'local_transit', 'pure_soy', 'live_plant', 'lifelike', 'zero_care', 'signature_ritual_pair');
  CREATE TYPE "public"."enum_products_shipping_class" AS ENUM('live_plant_bengaluru', 'standard', 'candle_protective');
  CREATE TYPE "public"."enum_products_plant_care_light" AS ENUM('low_light', 'indirect_sun', 'bright_light');
  CREATE TYPE "public"."enum_products_plant_care_water" AS ENUM('low', 'moderate', 'high');
  CREATE TYPE "public"."enum_products_plant_care_difficulty" AS ENUM('easy', 'moderate', 'expert');
  CREATE TYPE "public"."enum_product_collections_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_stock_adjustments_reason" AS ENUM('opening_stock', 'restock', 'damage', 'loss', 'correction', 'return_to_stock', 'other');
  CREATE TYPE "public"."enum_coupons_type" AS ENUM('percent', 'fixed');
  CREATE TYPE "public"."enum_journal_posts_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_care_guides_status" AS ENUM('draft', 'published');
  CREATE TABLE "customers_addresses" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"label" varchar,
  	"recipient" varchar NOT NULL,
  	"phone" varchar NOT NULL,
  	"line1" varchar NOT NULL,
  	"line2" varchar,
  	"city" varchar NOT NULL,
  	"state" varchar NOT NULL,
  	"pincode" varchar NOT NULL,
  	"is_default" boolean DEFAULT false
  );
  
  CREATE TABLE "customers_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "customers" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"phone" varchar,
  	"consent_marketing_email" boolean DEFAULT false,
  	"consent_whatsapp" boolean DEFAULT false,
  	"consent_recorded_at" timestamp(3) with time zone,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"reset_password_requested_at" timestamp(3) with time zone,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "products_images" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"image_id" integer NOT NULL
  );
  
  CREATE TABLE "products_badges" (
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"value" "enum_products_badges",
  	"id" serial PRIMARY KEY NOT NULL
  );
  
  CREATE TABLE "products_texts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer NOT NULL,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"text" varchar
  );
  
  CREATE TABLE "products_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"product_collections_id" integer
  );
  
  CREATE TABLE "variants" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"product_id" integer NOT NULL,
  	"sku" varchar NOT NULL,
  	"size" varchar,
  	"finish" varchar,
  	"scent" varchar,
  	"price_paise" numeric NOT NULL,
  	"compare_at_paise" numeric,
  	"weight_g" numeric,
  	"dimensions_length_cm" numeric,
  	"dimensions_width_cm" numeric,
  	"dimensions_height_cm" numeric,
  	"active" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "product_collections" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"status" "enum_product_collections_status" DEFAULT 'draft' NOT NULL,
  	"description" varchar,
  	"image_id" integer,
  	"sort_order" numeric DEFAULT 0,
  	"seo_meta_title" varchar,
  	"seo_meta_description" varchar,
  	"seo_og_image_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "stock_levels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"variant_id" integer NOT NULL,
  	"location" varchar DEFAULT 'Bengaluru' NOT NULL,
  	"on_hand" numeric DEFAULT 0 NOT NULL,
  	"reserved" numeric DEFAULT 0 NOT NULL,
  	"available" numeric DEFAULT 0 NOT NULL,
  	"low_stock_threshold" numeric DEFAULT 5 NOT NULL,
  	"is_low_stock" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "stock_adjustments" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"variant_id" integer NOT NULL,
  	"location" varchar DEFAULT 'Bengaluru' NOT NULL,
  	"delta" numeric NOT NULL,
  	"reason" "enum_stock_adjustments_reason" NOT NULL,
  	"note" varchar,
  	"stock_level_id" integer,
  	"previous_on_hand" numeric,
  	"new_on_hand" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "coupons" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"code" varchar NOT NULL,
  	"description" varchar,
  	"active" boolean DEFAULT false,
  	"type" "enum_coupons_type" DEFAULT 'percent' NOT NULL,
  	"value" numeric NOT NULL,
  	"max_discount_paise" numeric,
  	"min_order_paise" numeric DEFAULT 0,
  	"valid_from" timestamp(3) with time zone,
  	"valid_to" timestamp(3) with time zone,
  	"usage_limit" numeric,
  	"per_customer_limit" numeric,
  	"used_count" numeric DEFAULT 0,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "coupons_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"products_id" integer,
  	"product_collections_id" integer
  );
  
  CREATE TABLE "serviceable_pincodes" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"pincode" varchar NOT NULL,
  	"area" varchar,
  	"city" varchar DEFAULT 'Bengaluru' NOT NULL,
  	"state" varchar DEFAULT 'Karnataka',
  	"eta_min_days" numeric DEFAULT 0,
  	"eta_max_days" numeric DEFAULT 1,
  	"enabled" boolean DEFAULT true,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "journal_posts" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"status" "enum_journal_posts_status" DEFAULT 'draft' NOT NULL,
  	"excerpt" varchar,
  	"hero_image_id" integer,
  	"content" jsonb,
  	"published_at" timestamp(3) with time zone,
  	"author" varchar,
  	"seo_meta_title" varchar,
  	"seo_meta_description" varchar,
  	"seo_og_image_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "care_guides" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"title" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"status" "enum_care_guides_status" DEFAULT 'draft' NOT NULL,
  	"excerpt" varchar,
  	"hero_image_id" integer,
  	"content" jsonb,
  	"seo_meta_title" varchar,
  	"seo_meta_description" varchar,
  	"seo_og_image_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "care_guides_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"products_id" integer
  );
  
  ALTER TABLE "products" DROP CONSTRAINT "products_image_id_media_id_fk";
  
  DROP INDEX "products_image_idx";
  ALTER TABLE "products" ADD COLUMN "shipping_class" "enum_products_shipping_class";
  ALTER TABLE "products" ADD COLUMN "material" varchar;
  ALTER TABLE "products" ADD COLUMN "plant_care_light" "enum_products_plant_care_light";
  ALTER TABLE "products" ADD COLUMN "plant_care_water" "enum_products_plant_care_water";
  ALTER TABLE "products" ADD COLUMN "plant_care_difficulty" "enum_products_plant_care_difficulty";
  ALTER TABLE "products" ADD COLUMN "plant_care_pet_safe" boolean DEFAULT false;
  ALTER TABLE "products" ADD COLUMN "plant_care_air_purifying" boolean DEFAULT false;
  ALTER TABLE "products" ADD COLUMN "plant_care_care_guide_id" integer;
  ALTER TABLE "products" ADD COLUMN "candle_spec_wax_type" varchar DEFAULT 'Soy';
  ALTER TABLE "products" ADD COLUMN "candle_spec_scent_top" varchar;
  ALTER TABLE "products" ADD COLUMN "candle_spec_scent_heart" varchar;
  ALTER TABLE "products" ADD COLUMN "candle_spec_scent_base" varchar;
  ALTER TABLE "products" ADD COLUMN "candle_spec_burn_hours" numeric;
  ALTER TABLE "products" ADD COLUMN "candle_spec_vessel" varchar;
  ALTER TABLE "products" ADD COLUMN "search_keywords" varchar;
  ALTER TABLE "products" ADD COLUMN "min_price_paise" numeric;
  ALTER TABLE "products" ADD COLUMN "seo_meta_title" varchar;
  ALTER TABLE "products" ADD COLUMN "seo_meta_description" varchar;
  ALTER TABLE "products" ADD COLUMN "seo_og_image_id" integer;
  ALTER TABLE "pages" ADD COLUMN "seo_meta_title" varchar;
  ALTER TABLE "pages" ADD COLUMN "seo_meta_description" varchar;
  ALTER TABLE "pages" ADD COLUMN "seo_og_image_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "customers_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "variants_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "product_collections_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "stock_levels_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "stock_adjustments_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "coupons_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "serviceable_pincodes_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "journal_posts_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "care_guides_id" integer;
  ALTER TABLE "payload_preferences_rels" ADD COLUMN "customers_id" integer;
  ALTER TABLE "customers_addresses" ADD CONSTRAINT "customers_addresses_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "customers_sessions" ADD CONSTRAINT "customers_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_images" ADD CONSTRAINT "products_images_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "products_images" ADD CONSTRAINT "products_images_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_badges" ADD CONSTRAINT "products_badges_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_texts" ADD CONSTRAINT "products_texts_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_rels" ADD CONSTRAINT "products_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_rels" ADD CONSTRAINT "products_rels_product_collections_fk" FOREIGN KEY ("product_collections_id") REFERENCES "public"."product_collections"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "variants" ADD CONSTRAINT "variants_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "product_collections" ADD CONSTRAINT "product_collections_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "product_collections" ADD CONSTRAINT "product_collections_seo_og_image_id_media_id_fk" FOREIGN KEY ("seo_og_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "stock_levels" ADD CONSTRAINT "stock_levels_variant_id_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."variants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_variant_id_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."variants"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_stock_level_id_stock_levels_id_fk" FOREIGN KEY ("stock_level_id") REFERENCES "public"."stock_levels"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "coupons_rels" ADD CONSTRAINT "coupons_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."coupons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "coupons_rels" ADD CONSTRAINT "coupons_rels_products_fk" FOREIGN KEY ("products_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "coupons_rels" ADD CONSTRAINT "coupons_rels_product_collections_fk" FOREIGN KEY ("product_collections_id") REFERENCES "public"."product_collections"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "journal_posts" ADD CONSTRAINT "journal_posts_hero_image_id_media_id_fk" FOREIGN KEY ("hero_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "journal_posts" ADD CONSTRAINT "journal_posts_seo_og_image_id_media_id_fk" FOREIGN KEY ("seo_og_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "care_guides" ADD CONSTRAINT "care_guides_hero_image_id_media_id_fk" FOREIGN KEY ("hero_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "care_guides" ADD CONSTRAINT "care_guides_seo_og_image_id_media_id_fk" FOREIGN KEY ("seo_og_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "care_guides_rels" ADD CONSTRAINT "care_guides_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."care_guides"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "care_guides_rels" ADD CONSTRAINT "care_guides_rels_products_fk" FOREIGN KEY ("products_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "customers_addresses_order_idx" ON "customers_addresses" USING btree ("_order");
  CREATE INDEX "customers_addresses_parent_id_idx" ON "customers_addresses" USING btree ("_parent_id");
  CREATE INDEX "customers_sessions_order_idx" ON "customers_sessions" USING btree ("_order");
  CREATE INDEX "customers_sessions_parent_id_idx" ON "customers_sessions" USING btree ("_parent_id");
  CREATE INDEX "customers_updated_at_idx" ON "customers" USING btree ("updated_at");
  CREATE INDEX "customers_created_at_idx" ON "customers" USING btree ("created_at");
  CREATE UNIQUE INDEX "customers_email_idx" ON "customers" USING btree ("email");
  CREATE INDEX "products_images_order_idx" ON "products_images" USING btree ("_order");
  CREATE INDEX "products_images_parent_id_idx" ON "products_images" USING btree ("_parent_id");
  CREATE INDEX "products_images_image_idx" ON "products_images" USING btree ("image_id");
  CREATE INDEX "products_badges_order_idx" ON "products_badges" USING btree ("order");
  CREATE INDEX "products_badges_parent_idx" ON "products_badges" USING btree ("parent_id");
  CREATE INDEX "products_texts_order_parent" ON "products_texts" USING btree ("order","parent_id");
  CREATE INDEX "products_rels_order_idx" ON "products_rels" USING btree ("order");
  CREATE INDEX "products_rels_parent_idx" ON "products_rels" USING btree ("parent_id");
  CREATE INDEX "products_rels_path_idx" ON "products_rels" USING btree ("path");
  CREATE INDEX "products_rels_product_collections_id_idx" ON "products_rels" USING btree ("product_collections_id");
  CREATE INDEX "variants_product_idx" ON "variants" USING btree ("product_id");
  CREATE UNIQUE INDEX "variants_sku_idx" ON "variants" USING btree ("sku");
  CREATE INDEX "variants_finish_idx" ON "variants" USING btree ("finish");
  CREATE INDEX "variants_active_idx" ON "variants" USING btree ("active");
  CREATE INDEX "variants_updated_at_idx" ON "variants" USING btree ("updated_at");
  CREATE INDEX "variants_created_at_idx" ON "variants" USING btree ("created_at");
  CREATE UNIQUE INDEX "product_collections_slug_idx" ON "product_collections" USING btree ("slug");
  CREATE INDEX "product_collections_status_idx" ON "product_collections" USING btree ("status");
  CREATE INDEX "product_collections_image_idx" ON "product_collections" USING btree ("image_id");
  CREATE INDEX "product_collections_seo_seo_og_image_idx" ON "product_collections" USING btree ("seo_og_image_id");
  CREATE INDEX "product_collections_updated_at_idx" ON "product_collections" USING btree ("updated_at");
  CREATE INDEX "product_collections_created_at_idx" ON "product_collections" USING btree ("created_at");
  CREATE INDEX "stock_levels_variant_idx" ON "stock_levels" USING btree ("variant_id");
  CREATE INDEX "stock_levels_is_low_stock_idx" ON "stock_levels" USING btree ("is_low_stock");
  CREATE INDEX "stock_levels_updated_at_idx" ON "stock_levels" USING btree ("updated_at");
  CREATE INDEX "stock_levels_created_at_idx" ON "stock_levels" USING btree ("created_at");
  CREATE UNIQUE INDEX "variant_location_idx" ON "stock_levels" USING btree ("variant_id","location");
  CREATE INDEX "stock_adjustments_variant_idx" ON "stock_adjustments" USING btree ("variant_id");
  CREATE INDEX "stock_adjustments_stock_level_idx" ON "stock_adjustments" USING btree ("stock_level_id");
  CREATE INDEX "stock_adjustments_updated_at_idx" ON "stock_adjustments" USING btree ("updated_at");
  CREATE INDEX "stock_adjustments_created_at_idx" ON "stock_adjustments" USING btree ("created_at");
  CREATE UNIQUE INDEX "coupons_code_idx" ON "coupons" USING btree ("code");
  CREATE INDEX "coupons_active_idx" ON "coupons" USING btree ("active");
  CREATE INDEX "coupons_updated_at_idx" ON "coupons" USING btree ("updated_at");
  CREATE INDEX "coupons_created_at_idx" ON "coupons" USING btree ("created_at");
  CREATE INDEX "coupons_rels_order_idx" ON "coupons_rels" USING btree ("order");
  CREATE INDEX "coupons_rels_parent_idx" ON "coupons_rels" USING btree ("parent_id");
  CREATE INDEX "coupons_rels_path_idx" ON "coupons_rels" USING btree ("path");
  CREATE INDEX "coupons_rels_products_id_idx" ON "coupons_rels" USING btree ("products_id");
  CREATE INDEX "coupons_rels_product_collections_id_idx" ON "coupons_rels" USING btree ("product_collections_id");
  CREATE UNIQUE INDEX "serviceable_pincodes_pincode_idx" ON "serviceable_pincodes" USING btree ("pincode");
  CREATE INDEX "serviceable_pincodes_enabled_idx" ON "serviceable_pincodes" USING btree ("enabled");
  CREATE INDEX "serviceable_pincodes_updated_at_idx" ON "serviceable_pincodes" USING btree ("updated_at");
  CREATE INDEX "serviceable_pincodes_created_at_idx" ON "serviceable_pincodes" USING btree ("created_at");
  CREATE UNIQUE INDEX "journal_posts_slug_idx" ON "journal_posts" USING btree ("slug");
  CREATE INDEX "journal_posts_status_idx" ON "journal_posts" USING btree ("status");
  CREATE INDEX "journal_posts_hero_image_idx" ON "journal_posts" USING btree ("hero_image_id");
  CREATE INDEX "journal_posts_published_at_idx" ON "journal_posts" USING btree ("published_at");
  CREATE INDEX "journal_posts_seo_seo_og_image_idx" ON "journal_posts" USING btree ("seo_og_image_id");
  CREATE INDEX "journal_posts_updated_at_idx" ON "journal_posts" USING btree ("updated_at");
  CREATE INDEX "journal_posts_created_at_idx" ON "journal_posts" USING btree ("created_at");
  CREATE UNIQUE INDEX "care_guides_slug_idx" ON "care_guides" USING btree ("slug");
  CREATE INDEX "care_guides_status_idx" ON "care_guides" USING btree ("status");
  CREATE INDEX "care_guides_hero_image_idx" ON "care_guides" USING btree ("hero_image_id");
  CREATE INDEX "care_guides_seo_seo_og_image_idx" ON "care_guides" USING btree ("seo_og_image_id");
  CREATE INDEX "care_guides_updated_at_idx" ON "care_guides" USING btree ("updated_at");
  CREATE INDEX "care_guides_created_at_idx" ON "care_guides" USING btree ("created_at");
  CREATE INDEX "care_guides_rels_order_idx" ON "care_guides_rels" USING btree ("order");
  CREATE INDEX "care_guides_rels_parent_idx" ON "care_guides_rels" USING btree ("parent_id");
  CREATE INDEX "care_guides_rels_path_idx" ON "care_guides_rels" USING btree ("path");
  CREATE INDEX "care_guides_rels_products_id_idx" ON "care_guides_rels" USING btree ("products_id");
  ALTER TABLE "products" ADD CONSTRAINT "products_plant_care_care_guide_id_care_guides_id_fk" FOREIGN KEY ("plant_care_care_guide_id") REFERENCES "public"."care_guides"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "products" ADD CONSTRAINT "products_seo_og_image_id_media_id_fk" FOREIGN KEY ("seo_og_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "pages" ADD CONSTRAINT "pages_seo_og_image_id_media_id_fk" FOREIGN KEY ("seo_og_image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_customers_fk" FOREIGN KEY ("customers_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_variants_fk" FOREIGN KEY ("variants_id") REFERENCES "public"."variants"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_product_collections_fk" FOREIGN KEY ("product_collections_id") REFERENCES "public"."product_collections"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_stock_levels_fk" FOREIGN KEY ("stock_levels_id") REFERENCES "public"."stock_levels"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_stock_adjustments_fk" FOREIGN KEY ("stock_adjustments_id") REFERENCES "public"."stock_adjustments"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_coupons_fk" FOREIGN KEY ("coupons_id") REFERENCES "public"."coupons"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_serviceable_pincodes_fk" FOREIGN KEY ("serviceable_pincodes_id") REFERENCES "public"."serviceable_pincodes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_journal_posts_fk" FOREIGN KEY ("journal_posts_id") REFERENCES "public"."journal_posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_care_guides_fk" FOREIGN KEY ("care_guides_id") REFERENCES "public"."care_guides"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_customers_fk" FOREIGN KEY ("customers_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "products_type_idx" ON "products" USING btree ("type");
  CREATE INDEX "products_status_idx" ON "products" USING btree ("status");
  CREATE INDEX "products_shipping_class_idx" ON "products" USING btree ("shipping_class");
  CREATE INDEX "products_plant_care_plant_care_light_idx" ON "products" USING btree ("plant_care_light");
  CREATE INDEX "products_plant_care_plant_care_pet_safe_idx" ON "products" USING btree ("plant_care_pet_safe");
  CREATE INDEX "products_plant_care_plant_care_care_guide_idx" ON "products" USING btree ("plant_care_care_guide_id");
  CREATE INDEX "products_min_price_paise_idx" ON "products" USING btree ("min_price_paise");
  CREATE INDEX "products_seo_seo_og_image_idx" ON "products" USING btree ("seo_og_image_id");
  CREATE INDEX "pages_status_idx" ON "pages" USING btree ("status");
  CREATE INDEX "pages_seo_seo_og_image_idx" ON "pages" USING btree ("seo_og_image_id");
  CREATE INDEX "payload_locked_documents_rels_customers_id_idx" ON "payload_locked_documents_rels" USING btree ("customers_id");
  CREATE INDEX "payload_locked_documents_rels_variants_id_idx" ON "payload_locked_documents_rels" USING btree ("variants_id");
  CREATE INDEX "payload_locked_documents_rels_product_collections_id_idx" ON "payload_locked_documents_rels" USING btree ("product_collections_id");
  CREATE INDEX "payload_locked_documents_rels_stock_levels_id_idx" ON "payload_locked_documents_rels" USING btree ("stock_levels_id");
  CREATE INDEX "payload_locked_documents_rels_stock_adjustments_id_idx" ON "payload_locked_documents_rels" USING btree ("stock_adjustments_id");
  CREATE INDEX "payload_locked_documents_rels_coupons_id_idx" ON "payload_locked_documents_rels" USING btree ("coupons_id");
  CREATE INDEX "payload_locked_documents_rels_serviceable_pincodes_id_idx" ON "payload_locked_documents_rels" USING btree ("serviceable_pincodes_id");
  CREATE INDEX "payload_locked_documents_rels_journal_posts_id_idx" ON "payload_locked_documents_rels" USING btree ("journal_posts_id");
  CREATE INDEX "payload_locked_documents_rels_care_guides_id_idx" ON "payload_locked_documents_rels" USING btree ("care_guides_id");
  CREATE INDEX "payload_preferences_rels_customers_id_idx" ON "payload_preferences_rels" USING btree ("customers_id");
  -- Preserve the single image from before products supported many images.
  INSERT INTO "products_images" ("_order", "_parent_id", "id", "image_id")
    SELECT 1, "id", gen_random_uuid()::text, "image_id" FROM "products" WHERE "image_id" IS NOT NULL;
  ALTER TABLE "products" DROP COLUMN "image_id";

  -- Backfill the new required column for any existing rows, then enforce it.
  UPDATE "products" SET "shipping_class" = CASE "type"
    WHEN 'live_plant' THEN 'live_plant_bengaluru'
    WHEN 'candle' THEN 'candle_protective'
    ELSE 'standard' END::"enum_products_shipping_class";
  ALTER TABLE "products" ALTER COLUMN "shipping_class" SET NOT NULL;

  -- Constraints Payload cannot express. Money and counts are whole numbers.
  ALTER TABLE "products"
    ADD CONSTRAINT "products_slug_format_chk" CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
    ADD CONSTRAINT "products_min_price_chk" CHECK ("min_price_paise" IS NULL OR ("min_price_paise" >= 0 AND "min_price_paise" = trunc("min_price_paise")));
  ALTER TABLE "variants"
    ADD CONSTRAINT "variants_sku_format_chk" CHECK ("sku" ~ '^[A-Z0-9][A-Z0-9._-]{1,39}$'),
    ADD CONSTRAINT "variants_price_chk" CHECK ("price_paise" >= 0 AND "price_paise" = trunc("price_paise")),
    ADD CONSTRAINT "variants_compare_at_chk" CHECK ("compare_at_paise" IS NULL OR ("compare_at_paise" >= "price_paise" AND "compare_at_paise" = trunc("compare_at_paise"))),
    ADD CONSTRAINT "variants_weight_chk" CHECK ("weight_g" IS NULL OR ("weight_g" >= 0 AND "weight_g" = trunc("weight_g")));
  ALTER TABLE "stock_levels"
    ADD CONSTRAINT "stock_levels_non_negative_chk" CHECK ("on_hand" >= 0 AND "reserved" >= 0 AND "available" >= 0 AND "low_stock_threshold" >= 0),
    ADD CONSTRAINT "stock_levels_whole_chk" CHECK ("on_hand" = trunc("on_hand") AND "reserved" = trunc("reserved") AND "available" = trunc("available") AND "low_stock_threshold" = trunc("low_stock_threshold")),
    ADD CONSTRAINT "stock_levels_available_chk" CHECK ("available" = "on_hand" - "reserved");
  ALTER TABLE "stock_adjustments"
    ADD CONSTRAINT "stock_adjustments_delta_chk" CHECK ("delta" <> 0 AND "delta" = trunc("delta"));
  ALTER TABLE "coupons"
    ADD CONSTRAINT "coupons_code_format_chk" CHECK ("code" ~ '^[A-Z0-9][A-Z0-9_-]{2,31}$'),
    ADD CONSTRAINT "coupons_value_chk" CHECK ("value" = trunc("value") AND (("type" = 'percent' AND "value" BETWEEN 1 AND 100) OR ("type" = 'fixed' AND "value" >= 1))),
    ADD CONSTRAINT "coupons_amounts_chk" CHECK (COALESCE("max_discount_paise", 0) >= 0 AND COALESCE("min_order_paise", 0) >= 0),
    ADD CONSTRAINT "coupons_limits_chk" CHECK (COALESCE("usage_limit", 1) >= 1 AND COALESCE("per_customer_limit", 1) >= 1 AND COALESCE("used_count", 0) >= 0),
    ADD CONSTRAINT "coupons_validity_chk" CHECK ("valid_from" IS NULL OR "valid_to" IS NULL OR "valid_to" >= "valid_from");
  ALTER TABLE "serviceable_pincodes"
    ADD CONSTRAINT "serviceable_pincodes_format_chk" CHECK ("pincode" ~ '^[1-9][0-9]{5}$'),
    ADD CONSTRAINT "serviceable_pincodes_eta_chk" CHECK (COALESCE("eta_min_days", 0) >= 0 AND COALESCE("eta_max_days", 0) >= COALESCE("eta_min_days", 0));

  -- Full-text search (title > keywords > description) plus trigram matching for typos.
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
  ALTER TABLE "products" ADD COLUMN "search_vector" tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce("title", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("search_keywords", '')), 'B') ||
    setweight(to_tsvector('english', coalesce("description", '')), 'C')
  ) STORED;
  CREATE INDEX "products_search_vector_idx" ON "products" USING gin ("search_vector");
  CREATE INDEX "products_title_trgm_idx" ON "products" USING gin ("title" gin_trgm_ops);`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP INDEX IF EXISTS "products_search_vector_idx";
  DROP INDEX IF EXISTS "products_title_trgm_idx";
  ALTER TABLE "products" DROP COLUMN IF EXISTS "search_vector";
  ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "products_slug_format_chk", DROP CONSTRAINT IF EXISTS "products_min_price_chk";
  ALTER TABLE "customers_addresses" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "customers_sessions" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "customers" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "products_images" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "products_badges" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "products_texts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "products_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "variants" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "product_collections" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "stock_levels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "stock_adjustments" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "coupons" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "coupons_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "serviceable_pincodes" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "journal_posts" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "care_guides" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "care_guides_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "customers_addresses" CASCADE;
  DROP TABLE "customers_sessions" CASCADE;
  DROP TABLE "customers" CASCADE;
  DROP TABLE "products_images" CASCADE;
  DROP TABLE "products_badges" CASCADE;
  DROP TABLE "products_texts" CASCADE;
  DROP TABLE "products_rels" CASCADE;
  DROP TABLE "variants" CASCADE;
  DROP TABLE "product_collections" CASCADE;
  DROP TABLE "stock_levels" CASCADE;
  DROP TABLE "stock_adjustments" CASCADE;
  DROP TABLE "coupons" CASCADE;
  DROP TABLE "coupons_rels" CASCADE;
  DROP TABLE "serviceable_pincodes" CASCADE;
  DROP TABLE "journal_posts" CASCADE;
  DROP TABLE "care_guides" CASCADE;
  DROP TABLE "care_guides_rels" CASCADE;
  ALTER TABLE "products" DROP CONSTRAINT "products_plant_care_care_guide_id_care_guides_id_fk";
  
  ALTER TABLE "products" DROP CONSTRAINT "products_seo_og_image_id_media_id_fk";
  
  ALTER TABLE "pages" DROP CONSTRAINT "pages_seo_og_image_id_media_id_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_customers_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_variants_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_product_collections_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_stock_levels_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_stock_adjustments_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_coupons_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_serviceable_pincodes_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_journal_posts_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_care_guides_fk";
  
  ALTER TABLE "payload_preferences_rels" DROP CONSTRAINT "payload_preferences_rels_customers_fk";
  
  DROP INDEX "products_type_idx";
  DROP INDEX "products_status_idx";
  DROP INDEX "products_shipping_class_idx";
  DROP INDEX "products_plant_care_plant_care_light_idx";
  DROP INDEX "products_plant_care_plant_care_pet_safe_idx";
  DROP INDEX "products_plant_care_plant_care_care_guide_idx";
  DROP INDEX "products_min_price_paise_idx";
  DROP INDEX "products_seo_seo_og_image_idx";
  DROP INDEX "pages_status_idx";
  DROP INDEX "pages_seo_seo_og_image_idx";
  DROP INDEX "payload_locked_documents_rels_customers_id_idx";
  DROP INDEX "payload_locked_documents_rels_variants_id_idx";
  DROP INDEX "payload_locked_documents_rels_product_collections_id_idx";
  DROP INDEX "payload_locked_documents_rels_stock_levels_id_idx";
  DROP INDEX "payload_locked_documents_rels_stock_adjustments_id_idx";
  DROP INDEX "payload_locked_documents_rels_coupons_id_idx";
  DROP INDEX "payload_locked_documents_rels_serviceable_pincodes_id_idx";
  DROP INDEX "payload_locked_documents_rels_journal_posts_id_idx";
  DROP INDEX "payload_locked_documents_rels_care_guides_id_idx";
  DROP INDEX "payload_preferences_rels_customers_id_idx";
  ALTER TABLE "products" ADD COLUMN "image_id" integer;
  ALTER TABLE "products" ADD CONSTRAINT "products_image_id_media_id_fk" FOREIGN KEY ("image_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "products_image_idx" ON "products" USING btree ("image_id");
  ALTER TABLE "products" DROP COLUMN "shipping_class";
  ALTER TABLE "products" DROP COLUMN "material";
  ALTER TABLE "products" DROP COLUMN "plant_care_light";
  ALTER TABLE "products" DROP COLUMN "plant_care_water";
  ALTER TABLE "products" DROP COLUMN "plant_care_difficulty";
  ALTER TABLE "products" DROP COLUMN "plant_care_pet_safe";
  ALTER TABLE "products" DROP COLUMN "plant_care_air_purifying";
  ALTER TABLE "products" DROP COLUMN "plant_care_care_guide_id";
  ALTER TABLE "products" DROP COLUMN "candle_spec_wax_type";
  ALTER TABLE "products" DROP COLUMN "candle_spec_scent_top";
  ALTER TABLE "products" DROP COLUMN "candle_spec_scent_heart";
  ALTER TABLE "products" DROP COLUMN "candle_spec_scent_base";
  ALTER TABLE "products" DROP COLUMN "candle_spec_burn_hours";
  ALTER TABLE "products" DROP COLUMN "candle_spec_vessel";
  ALTER TABLE "products" DROP COLUMN "search_keywords";
  ALTER TABLE "products" DROP COLUMN "min_price_paise";
  ALTER TABLE "products" DROP COLUMN "seo_meta_title";
  ALTER TABLE "products" DROP COLUMN "seo_meta_description";
  ALTER TABLE "products" DROP COLUMN "seo_og_image_id";
  ALTER TABLE "pages" DROP COLUMN "seo_meta_title";
  ALTER TABLE "pages" DROP COLUMN "seo_meta_description";
  ALTER TABLE "pages" DROP COLUMN "seo_og_image_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "customers_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "variants_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "product_collections_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "stock_levels_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "stock_adjustments_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "coupons_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "serviceable_pincodes_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "journal_posts_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "care_guides_id";
  ALTER TABLE "payload_preferences_rels" DROP COLUMN "customers_id";
  DROP TYPE "public"."enum_products_badges";
  DROP TYPE "public"."enum_products_shipping_class";
  DROP TYPE "public"."enum_products_plant_care_light";
  DROP TYPE "public"."enum_products_plant_care_water";
  DROP TYPE "public"."enum_products_plant_care_difficulty";
  DROP TYPE "public"."enum_product_collections_status";
  DROP TYPE "public"."enum_stock_adjustments_reason";
  DROP TYPE "public"."enum_coupons_type";
  DROP TYPE "public"."enum_journal_posts_status";
  DROP TYPE "public"."enum_care_guides_status";`)
}
