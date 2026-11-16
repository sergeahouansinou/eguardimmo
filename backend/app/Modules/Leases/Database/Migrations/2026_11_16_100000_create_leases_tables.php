<?php

declare(strict_types=1);

use App\Modules\Leases\Enums\BillingTiming;
use App\Modules\Leases\Enums\LeasePartyRole;
use App\Modules\Leases\Enums\LeaseStatus;
use App\Modules\Leases\Enums\NoticeGivenBy;
use App\Modules\Leases\Enums\PaymentMethod;
use App\Modules\Leases\Enums\Periodicity;
use App\Modules\Leases\Enums\TermChangeReason;
use App\Shared\Database\Checks;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Query\Expression;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('lease_sequences', function (Blueprint $table): void {
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->unsignedSmallInteger('year');
            $table->unsignedInteger('last_value')->default(0);

            $table->primary(['organization_id', 'year']);
        });

        Schema::create('lease_unit_locks', function (Blueprint $table): void {
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('unit_id');
            $table->unsignedInteger('last_value')->default(0);

            $table->primary(['organization_id', 'unit_id']);
        });

        Schema::create('leases', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->string('reference', 20);
            $table->char('jurisdiction', 2);
            $table->string('regime_key', 80);
            $table->string('status', 16);
            $table->date('starts_on');
            $table->unsignedSmallInteger('duration_months');
            $table->boolean('tacit_renewal')->default(false);
            $table->date('ends_on')->nullable();
            $table->unsignedTinyInteger('due_day');
            $table->string('periodicity', 16);
            $table->string('billing_timing', 16);
            $table->char('currency', 3);
            $table->string('payment_method', 16)->nullable();
            $table->date('signed_on')->nullable();
            $table->uuid('signed_file_id')->nullable();
            $table->date('notice_received_on')->nullable();
            $table->string('notice_given_by', 16)->nullable();
            $table->date('notice_departure_on')->nullable();
            $table->string('termination_reason', 255)->nullable();
            $table->json('jurisdiction_data')->default(new Expression('(JSON_OBJECT())'));
            $table->json('custom_fields')->default(new Expression('(JSON_OBJECT())'));
            $table->text('note')->nullable();
            $table->unsignedInteger('lock_version')->default(1);
            $table->dateTime('archived_at', 6)->nullable();
            $table->uuid('created_by_user_id')->nullable();
            $table->datetimes(6);

            $table->unique(['organization_id', 'id']);
            $table->unique(['organization_id', 'reference']);
            $table->index(['organization_id', 'status', 'starts_on']);
        });

        Schema::create('lease_units', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('lease_id');
            $table->uuid('unit_id');
            $table->boolean('is_main')->default(false);
            $table->date('valid_from');
            $table->date('valid_to')->nullable();
            $table->uuid('main_of_lease')->nullable()->virtualAs('CASE WHEN is_main = 1 AND valid_to IS NULL THEN lease_id END');
            $table->datetimes(6);

            $table->unique(['organization_id', 'id']);
            $table->unique(['lease_id', 'unit_id', 'valid_from']);
            $table->unique('main_of_lease');
            $table->index(['organization_id', 'unit_id', 'valid_from']);
            $table->foreign(['organization_id', 'lease_id'])->references(['organization_id', 'id'])->on('leases');
        });

        Schema::create('lease_parties', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('lease_id');
            $table->uuid('party_id');
            $table->string('role', 16);
            $table->boolean('joint_liability')->default(false);
            $table->uuid('guarantees_party_id')->nullable();
            $table->unsignedBigInteger('guarantee_limit_amount')->nullable();
            $table->char('guarantee_currency', 3)->nullable();
            $table->date('guarantee_ends_on')->nullable();
            $table->date('valid_from');
            $table->date('valid_to')->nullable();
            $table->datetimes(6);

            $table->unique(['organization_id', 'id']);
            $table->index(['lease_id', 'role', 'valid_from']);
            $table->index(['organization_id', 'party_id', 'role']);
            $table->foreign(['organization_id', 'lease_id'])->references(['organization_id', 'id'])->on('leases');
        });

        Schema::create('lease_terms', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('lease_id');
            $table->foreignUuid('component_term_id')->constrained('terms');
            $table->unsignedBigInteger('amount');
            $table->char('currency', 3);
            $table->unsignedSmallInteger('vat_bp')->default(0);
            $table->boolean('indexed')->default(false);
            $table->date('valid_from');
            $table->date('valid_to')->nullable();
            $table->string('reason', 16);
            $table->uuid('replaces_id')->nullable();
            $table->uuid('created_by_user_id')->nullable();
            $table->datetimes(6);

            $table->unique(['organization_id', 'id']);
            $table->unique(['organization_id', 'replaces_id']);
            $table->index(['lease_id', 'component_term_id', 'valid_from']);
            $table->foreign(['organization_id', 'lease_id'])->references(['organization_id', 'id'])->on('leases');
            $table->foreign(['organization_id', 'replaces_id'])->references(['organization_id', 'id'])->on('lease_terms');
        });

        Checks::add('leases', 'reference', "REGEXP_LIKE(reference, '^BL-[0-9]{4}-[0-9]{4,}$')");
        Checks::add('leases', 'jurisdiction', Checks::uppercase('jurisdiction', 2));
        Checks::add('leases', 'currency', Checks::uppercase('currency', 3));
        Checks::add('leases', 'status', Checks::enum('status', LeaseStatus::class));
        Checks::add('leases', 'periodicity', Checks::enum('periodicity', Periodicity::class));
        Checks::add('leases', 'billing_timing', Checks::enum('billing_timing', BillingTiming::class));
        Checks::add('leases', 'payment_method', Checks::enum('payment_method', PaymentMethod::class, nullable: true));
        Checks::add('leases', 'notice_given_by', Checks::enum('notice_given_by', NoticeGivenBy::class, nullable: true));
        Checks::add('leases', 'due_day', 'due_day BETWEEN 1 AND 28');
        Checks::add('leases', 'duration', 'duration_months > 0');
        Checks::add('leases', 'period', 'ends_on IS NULL OR ends_on > starts_on');
        Checks::add('leases', 'signed', "status IN ('draft', 'cancelled') OR signed_on IS NOT NULL");
        Checks::add('leases', 'notice', '(notice_received_on IS NULL AND notice_given_by IS NULL AND notice_departure_on IS NULL AND termination_reason IS NULL)'
            .' OR (notice_received_on IS NOT NULL AND notice_given_by IS NOT NULL AND notice_departure_on IS NOT NULL AND termination_reason IS NOT NULL)');

        Checks::add('lease_units', 'period', 'valid_to IS NULL OR valid_to > valid_from');

        Checks::add('lease_parties', 'role', Checks::enum('role', LeasePartyRole::class));
        Checks::add('lease_parties', 'period', 'valid_to IS NULL OR valid_to > valid_from');
        Checks::add('lease_parties', 'guarantee_currency', Checks::uppercase('guarantee_currency', 3));
        Checks::add('lease_parties', 'guarantee_amount', '(guarantee_limit_amount IS NULL) = (guarantee_currency IS NULL)');
        Checks::add('lease_parties', 'guarantee_role', "role = 'guarantor' OR (guarantees_party_id IS NULL AND guarantee_limit_amount IS NULL AND guarantee_currency IS NULL AND guarantee_ends_on IS NULL)");

        Checks::add('lease_terms', 'currency', Checks::uppercase('currency', 3));
        Checks::add('lease_terms', 'amount', 'amount >= 0');
        Checks::add('lease_terms', 'vat', 'vat_bp BETWEEN 0 AND 10000');
        Checks::add('lease_terms', 'period', 'valid_to IS NULL OR valid_to > valid_from');
        Checks::add('lease_terms', 'reason', Checks::enum('reason', TermChangeReason::class));
        Checks::add('lease_terms', 'replaces', 'replaces_id IS NULL OR replaces_id <> id');
    }

    public function down(): void
    {
        Schema::dropIfExists('lease_terms');
        Schema::dropIfExists('lease_parties');
        Schema::dropIfExists('lease_units');
        Schema::dropIfExists('leases');
        Schema::dropIfExists('lease_unit_locks');
        Schema::dropIfExists('lease_sequences');
    }
};
