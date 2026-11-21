<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tax_summaries', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->string('scope', 16);
            $table->uuid('mandant_party_id')->nullable();
            $table->unsignedSmallInteger('income_year');
            $table->string('form_version', 24);
            $table->string('status', 16);
            $table->char('currency', 3);
            $table->json('snapshot');
            $table->string('ledger_cutoff', 64)->nullable();
            $table->char('fingerprint', 64);
            $table->string('template_version', 16);
            $table->uuid('issued_document_id')->nullable();
            $table->uuid('stored_file_id')->nullable();
            $table->uuid('supersedes_id')->nullable();
            $table->string('rectification_reason', 500)->nullable();
            $table->string('idempotency_key', 64);
            $table->char('request_hash', 64);
            $table->unsignedInteger('lock_version')->default(1);
            $table->string('active_key', 120)->nullable();
            $table->timestamp('published_at', 6)->nullable();
            $table->uuid('published_by_user_id')->nullable();
            $table->uuid('created_by_user_id')->nullable();
            $table->datetimes(6);

            $table->unique(['organization_id', 'idempotency_key'], 'tax_sum_org_key_unique');
            $table->unique(['organization_id', 'active_key'], 'tax_sum_org_active_unique');
            $table->unique(['organization_id', 'id'], 'tax_sum_org_id_unique');
            $table->index(['organization_id', 'scope', 'income_year'], 'tax_sum_org_scope_year_idx');
            $table->index(['mandant_party_id', 'status', 'income_year'], 'tax_sum_mandant_idx');
            $table->foreign(['organization_id', 'supersedes_id'], 'tax_sum_supersedes_fk')->references(['organization_id', 'id'])->on('tax_summaries');
        });

        Schema::create('tax_summary_lines', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->foreignUuid('summary_id')->constrained('tax_summaries');
            $table->uuid('property_id')->nullable();
            $table->string('line_code', 8);
            $table->string('status', 16);
            $table->bigInteger('amount_exact');
            $table->bigInteger('amount_rounded');
            $table->json('sources');
            $table->unsignedSmallInteger('position');
            $table->datetimes(6);

            $table->index(['summary_id', 'position'], 'tax_lines_summary_idx');
            $table->index(['organization_id', 'property_id'], 'tax_lines_property_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tax_summary_lines');
        Schema::dropIfExists('tax_summaries');
    }
};
