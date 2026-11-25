<?php

declare(strict_types=1);

use App\Modules\Listings\Enums\CancellationPolicy;
use App\Modules\Listings\Enums\LeadStatus;
use App\Modules\Listings\Enums\ListingCategory;
use App\Modules\Listings\Enums\ListingKind;
use App\Modules\Listings\Enums\ListingStatus;
use App\Modules\Listings\Enums\PriceUnit;
use App\Shared\Database\Checks;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('listings', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('public_ref', 12)->unique();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('unit_id')->nullable();
            $table->string('kind', 16);
            $table->string('category', 16);
            $table->string('title', 120)->nullable();
            $table->text('description')->nullable();
            $table->uuid('city_id')->nullable();
            $table->string('neighbourhood', 80)->nullable();
            $table->unsignedBigInteger('price_minor')->nullable();
            $table->char('currency', 3)->default('EUR');
            $table->string('price_unit', 8);
            $table->unsignedSmallInteger('capacity')->nullable();
            $table->unsignedSmallInteger('area_m2')->nullable();
            $table->unsignedSmallInteger('rooms')->nullable();
            $table->json('amenities');
            $table->unsignedSmallInteger('min_nights')->default(1);
            $table->string('cancellation_policy', 16)->default(CancellationPolicy::Moderate->value);
            $table->unsignedBigInteger('deposit_minor')->nullable();
            $table->string('status', 12)->default(ListingStatus::Draft->value);
            $table->dateTime('published_at', 6)->nullable();
            $table->unsignedInteger('lock_version')->default(1);
            $table->datetimes(6);

            $table->unique(['organization_id', 'id'], 'listings_org_id_unique');
            $table->index(['organization_id', 'status', 'created_at'], 'listings_org_status_idx');
            $table->index(['status', 'city_id', 'published_at'], 'listings_search_idx');
            $table->index(['status', 'price_minor'], 'listings_price_idx');
        });

        Schema::create('listing_favorites', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('user_id');
            $table->foreignUuid('listing_id')->constrained('listings');
            $table->datetimes(6);

            $table->unique(['user_id', 'listing_id'], 'listing_favorites_user_listing_unique');
            $table->index(['user_id', 'created_at'], 'listing_favorites_user_idx');
        });

        Schema::create('listing_leads', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->foreignUuid('listing_id')->constrained('listings');
            $table->uuid('user_id');
            $table->string('requested_slot', 120);
            $table->string('message', 1000)->nullable();
            $table->string('status', 12)->default(LeadStatus::New->value);
            $table->datetimes(6);

            $table->index(['organization_id', 'status', 'created_at'], 'listing_leads_org_status_idx');
            $table->index(['user_id', 'created_at'], 'listing_leads_user_idx');
        });

        Checks::add('listings', 'kind', Checks::enum('kind', ListingKind::class));
        Checks::add('listings', 'category', Checks::enum('category', ListingCategory::class));
        Checks::add('listings', 'price_unit', Checks::enum('price_unit', PriceUnit::class));
        Checks::add('listings', 'cancellation_policy', Checks::enum('cancellation_policy', CancellationPolicy::class));
        Checks::add('listings', 'status', Checks::enum('status', ListingStatus::class));
        Checks::add('listings', 'published_fields', "status <> 'published' OR (title IS NOT NULL AND price_minor IS NOT NULL AND city_id IS NOT NULL AND capacity IS NOT NULL AND published_at IS NOT NULL)");
        Checks::add('listing_leads', 'status', Checks::enum('status', LeadStatus::class));
    }

    public function down(): void
    {
        Schema::dropIfExists('listing_leads');
        Schema::dropIfExists('listing_favorites');
        Schema::dropIfExists('listings');
    }
};
