<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('parties', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->string('kind', 16);
            $table->string('display_name', 255);
            $table->string('last_name', 120)->nullable();
            $table->string('first_name', 120)->nullable();
            $table->string('company_name', 200)->nullable();
            $table->foreignUuid('legal_form_term_id')->nullable()->constrained('terms');
            $table->date('birth_date')->nullable();
            $table->json('address')->nullable();
            $table->string('language', 5)->default('fr');
            $table->uuid('user_id')->nullable();
            $table->json('custom_fields');
            $table->unsignedInteger('lock_version')->default(1);
            $table->dateTime('anonymized_at', 6)->nullable();
            $table->dateTime('archived_at', 6)->nullable();
            $table->datetimes(6);

            $table->unique(['organization_id', 'id']);
            $table->index(['organization_id', 'display_name', 'id']);
            $table->index('user_id');
        });

        Schema::create('party_contact_categories', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('party_id');
            $table->foreignUuid('contact_category_term_id')->constrained('terms');
            $table->datetimes(6);

            $table->unique(['party_id', 'contact_category_term_id']);
            $table->index('contact_category_term_id');
            $table->foreign(['organization_id', 'party_id'])->references(['organization_id', 'id'])->on('parties');
        });

        Schema::create('contact_points', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('party_id');
            $table->string('type', 16);
            $table->string('value', 254)->nullable();
            $table->string('label', 60)->nullable();
            $table->boolean('is_primary')->default(false);
            $table->unsignedTinyInteger('primary_slot')->nullable();
            $table->datetimes(6);

            $table->unique(['party_id', 'type', 'primary_slot']);
            $table->index(['organization_id', 'type', 'value']);
            $table->foreign(['organization_id', 'party_id'])->references(['organization_id', 'id'])->on('parties');
        });

        Schema::create('party_identifiers', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('party_id');
            $table->string('scheme', 24);
            $table->char('country', 2);
            $table->text('value')->nullable();
            $table->char('value_hash', 64)->nullable();
            $table->datetimes(6);

            $table->unique(['organization_id', 'scheme', 'country', 'value_hash']);
            $table->index('party_id');
            $table->foreign(['organization_id', 'party_id'])->references(['organization_id', 'id'])->on('parties');
        });

        Schema::create('bank_accounts', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('party_id');
            $table->text('iban')->nullable();
            $table->char('iban_last4', 4)->nullable();
            $table->char('iban_hash', 64)->nullable();
            $table->string('bic', 11)->nullable();
            $table->string('holder_name', 200)->nullable();
            $table->date('valid_from');
            $table->date('valid_to')->nullable();
            $table->datetimes(6);

            $table->index(['party_id', 'valid_from']);
            $table->index(['organization_id', 'iban_hash']);
            $table->foreign(['organization_id', 'party_id'])->references(['organization_id', 'id'])->on('parties');
        });

        if (in_array(DB::getDriverName(), ['mysql', 'mariadb'], true)) {
            DB::statement("ALTER TABLE parties ADD CONSTRAINT parties_kind_check CHECK (kind IN ('person', 'company'))");
            DB::statement("ALTER TABLE contact_points ADD CONSTRAINT contact_points_type_check CHECK (type IN ('email', 'phone'))");
            DB::statement('ALTER TABLE contact_points ADD CONSTRAINT contact_points_primary_check CHECK ((is_primary = 1) = (primary_slot IS NOT NULL))');
            DB::statement("ALTER TABLE party_identifiers ADD CONSTRAINT party_identifiers_country_check CHECK (country REGEXP '^[A-Z]{2}$')");
            DB::statement('ALTER TABLE bank_accounts ADD CONSTRAINT bank_accounts_period_check CHECK (valid_to IS NULL OR valid_to >= valid_from)');
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('bank_accounts');
        Schema::dropIfExists('party_identifiers');
        Schema::dropIfExists('contact_points');
        Schema::dropIfExists('party_contact_categories');
        Schema::dropIfExists('parties');
    }
};
