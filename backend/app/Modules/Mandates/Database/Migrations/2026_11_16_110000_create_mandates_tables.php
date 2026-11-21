<?php

declare(strict_types=1);

use App\Modules\Mandates\Enums\FeeKind;
use App\Modules\Mandates\Enums\MandateStatus;
use App\Modules\Mandates\Enums\TermChangeReason;
use App\Shared\Database\Checks;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Query\Expression;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('mandate_sequences', function (Blueprint $table): void {
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->unsignedSmallInteger('year');
            $table->unsignedInteger('last_value')->default(0);

            $table->primary(['organization_id', 'year']);
        });

        Schema::create('mandate_unit_locks', function (Blueprint $table): void {
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('unit_id');
            $table->unsignedInteger('last_value')->default(0);

            $table->primary(['organization_id', 'unit_id']);
        });

        Schema::create('mandates', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->string('reference', 20);
            $table->uuid('mandant_party_id');
            $table->foreignUuid('mandate_type_term_id')->constrained('terms');
            $table->string('status', 16);
            $table->date('starts_on');
            $table->date('ends_on');
            $table->boolean('tacit_renewal')->default(false);
            $table->unsignedSmallInteger('renewal_months')->default(12);
            $table->unsignedSmallInteger('notice_months')->default(3);
            $table->char('currency', 3);
            $table->date('signed_on')->nullable();
            $table->uuid('signed_file_id')->nullable();
            $table->date('notice_given_on')->nullable();
            $table->string('termination_reason', 255)->nullable();
            $table->text('termination_note')->nullable();
            $table->json('custom_fields')->default(new Expression('(JSON_OBJECT())'));
            $table->text('note')->nullable();
            $table->unsignedInteger('lock_version')->default(1);
            $table->dateTime('archived_at', 6)->nullable();
            $table->uuid('created_by_user_id')->nullable();
            $table->datetimes(6);

            $table->unique(['organization_id', 'id']);
            $table->unique(['organization_id', 'reference']);
            $table->index(['organization_id', 'status', 'starts_on']);
            $table->index(['organization_id', 'mandant_party_id']);
        });

        Schema::create('mandate_units', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('mandate_id');
            $table->uuid('unit_id');
            $table->date('valid_from');
            $table->date('valid_to')->nullable();
            $table->datetimes(6);

            $table->unique(['organization_id', 'id']);
            $table->unique(['mandate_id', 'unit_id', 'valid_from']);
            $table->index(['organization_id', 'unit_id', 'valid_from']);
            $table->foreign(['organization_id', 'mandate_id'])->references(['organization_id', 'id'])->on('mandates');
        });

        Schema::create('mandate_terms', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('mandate_id');
            $table->string('fee_kind', 16);
            $table->unsignedSmallInteger('fee_basis_points')->nullable();
            $table->unsignedBigInteger('fee_flat_amount')->nullable();
            $table->char('currency', 3);
            $table->unsignedTinyInteger('payout_day');
            $table->unsignedBigInteger('works_limit_amount')->default(0);
            $table->date('valid_from');
            $table->date('valid_to')->nullable();
            $table->string('reason', 16);
            $table->uuid('replaces_id')->nullable();
            $table->uuid('open_of_mandate')->nullable()->virtualAs('CASE WHEN valid_to IS NULL THEN mandate_id END');
            $table->uuid('created_by_user_id')->nullable();
            $table->datetimes(6);

            $table->unique(['organization_id', 'id']);
            $table->unique(['mandate_id', 'valid_from']);
            $table->unique('open_of_mandate');
            $table->unique(['organization_id', 'replaces_id']);
            $table->foreign(['organization_id', 'mandate_id'])->references(['organization_id', 'id'])->on('mandates');
            $table->foreign(['organization_id', 'replaces_id'])->references(['organization_id', 'id'])->on('mandate_terms');
        });

        Checks::add('mandates', 'reference', "REGEXP_LIKE(reference, '^M-[0-9]{4}-[0-9]{4,}$')");
        Checks::add('mandates', 'currency', Checks::uppercase('currency', 3));
        Checks::add('mandates', 'status', Checks::enum('status', MandateStatus::class));
        Checks::add('mandates', 'period', 'ends_on > starts_on');
        Checks::add('mandates', 'renewal', 'renewal_months BETWEEN 1 AND 120');
        Checks::add('mandates', 'notice', 'notice_months BETWEEN 0 AND 24');
        Checks::add('mandates', 'signed', "status = 'draft' OR signed_on IS NOT NULL");
        Checks::add('mandates', 'termination', "status <> 'terminated' OR (notice_given_on IS NOT NULL AND termination_reason IS NOT NULL)");

        Checks::add('mandate_units', 'period', 'valid_to IS NULL OR valid_to > valid_from');

        Checks::add('mandate_terms', 'currency', Checks::uppercase('currency', 3));
        Checks::add('mandate_terms', 'fee_kind', Checks::enum('fee_kind', FeeKind::class));
        Checks::add('mandate_terms', 'fee', "(fee_kind = 'percentage' AND fee_basis_points BETWEEN 0 AND 10000 AND fee_flat_amount IS NULL)"
            ." OR (fee_kind = 'flat' AND fee_flat_amount IS NOT NULL AND fee_basis_points IS NULL)");
        Checks::add('mandate_terms', 'payout_day', 'payout_day BETWEEN 1 AND 28');
        Checks::add('mandate_terms', 'period', 'valid_to IS NULL OR valid_to > valid_from');
        Checks::add('mandate_terms', 'reason', Checks::enum('reason', TermChangeReason::class));
        Checks::add('mandate_terms', 'replaces', 'replaces_id IS NULL OR replaces_id <> id');
    }

    public function down(): void
    {
        Schema::dropIfExists('mandate_terms');
        Schema::dropIfExists('mandate_units');
        Schema::dropIfExists('mandates');
        Schema::dropIfExists('mandate_unit_locks');
        Schema::dropIfExists('mandate_sequences');
    }
};
