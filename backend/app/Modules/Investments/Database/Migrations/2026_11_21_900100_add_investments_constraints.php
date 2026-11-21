<?php

declare(strict_types=1);

use App\Modules\Investments\Enums\DeferralKind;
use App\Modules\Investments\Enums\FeeKind;
use App\Modules\Investments\Enums\InsuranceMode;
use App\Modules\Investments\Enums\LoanPurpose;
use App\Modules\Investments\Enums\LoanStatus;
use App\Modules\Investments\Enums\ScheduleReason;
use App\Modules\Investments\Enums\ScheduleSource;
use App\Shared\Database\Checks;
use App\Shared\Database\RowGuards;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        Checks::add('property_acquisitions', 'currency', Checks::uppercase('currency', 3));
        Checks::add('property_acquisitions', 'price', 'price > 0');
        Checks::add('loans', 'currency', Checks::uppercase('currency', 3));
        Checks::add('loans', 'purpose', Checks::enum('purpose', LoanPurpose::class));
        Checks::add('loans', 'deferral', Checks::enum('deferral_kind', DeferralKind::class));
        Checks::add('loans', 'insurance_mode', Checks::enum('insurance_mode', InsuranceMode::class));
        Checks::add('loans', 'schedule_source', Checks::enum('schedule_source', ScheduleSource::class));
        Checks::add('loans', 'status', Checks::enum('status', LoanStatus::class));
        Checks::add('loans', 'terms', 'principal > 0 AND term_months BETWEEN 1 AND 600 AND nominal_rate >= 0 AND deferral_months < term_months');
        Checks::add('loan_schedules', 'reason', Checks::enum('reason', ScheduleReason::class));
        Checks::add('loan_fees', 'kind', Checks::enum('kind', FeeKind::class));

        RowGuards::install([
            ['loans_figes', 'BEFORE UPDATE', 'loans', RowGuards::changed(['id', 'organization_id', 'property_id', 'unit_id', 'lender_label', 'contract_reference', 'purpose', 'currency', 'principal', 'nominal_rate', 'first_due_on', 'term_months', 'deferral_kind', 'deferral_months', 'insurance_mode', 'insurance_rate', 'insurance_amount', 'replaces_loan_id', 'stored_file_id', 'idempotency_key', 'fingerprint', 'created_at']), 'loans : conditions figees'],
            ['loans_sans_suppression', 'BEFORE DELETE', 'loans', '1 = 1', 'loans ne se supprime pas'],
            ['property_acquisitions_sans_suppression', 'BEFORE DELETE', 'property_acquisitions', '1 = 1', 'property_acquisitions ne se supprime pas'],
            ['property_acquisitions_portee_figee', 'BEFORE UPDATE', 'property_acquisitions', RowGuards::changed(['organization_id', 'property_id', 'unit_id', 'scope_key', 'idempotency_key', 'fingerprint']), 'property_acquisitions : portee figee'],
            ...RowGuards::frozenExcept('loan_schedules', ['id', 'organization_id', 'loan_id', 'version', 'effective_from', 'reason', 'created_at', 'updated_at'], []),
            ...RowGuards::frozenExcept('loan_schedule_lines', ['id', 'organization_id', 'loan_schedule_id', 'loan_id', 'position', 'due_on', 'currency', 'payment', 'interest', 'principal', 'insurance', 'outstanding_after', 'created_at', 'updated_at'], []),
            ...RowGuards::frozenExcept('loan_fees', ['id', 'organization_id', 'loan_id', 'kind', 'paid_on', 'currency', 'amount', 'stored_file_id', 'created_at', 'updated_at'], []),
            ...RowGuards::frozenExcept('loan_interest_attestations', ['id', 'organization_id', 'loan_id', 'income_year', 'currency', 'interest', 'insurance', 'fees', 'stored_file_id', 'created_at', 'updated_at'], []),
            ...RowGuards::frozenExcept('loan_usages', ['id', 'organization_id', 'loan_id', 'income_year', 'created_at', 'updated_at'], []),
        ]);
    }

    public function down(): void
    {
        // Contraintes et déclencheurs tombent avec leurs tables (migration 900000).
    }
};
