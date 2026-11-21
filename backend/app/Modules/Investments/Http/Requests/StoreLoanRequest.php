<?php

declare(strict_types=1);

namespace App\Modules\Investments\Http\Requests;

use App\Modules\Investments\Data\LoanTermsData;
use App\Modules\Investments\Data\NewLoanData;
use App\Modules\Investments\Enums\DeferralKind;
use App\Modules\Investments\Enums\InsuranceMode;
use App\Modules\Investments\Enums\LoanPurpose;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class StoreLoanRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Mensualité, intérêts, capital restant dû, devise et statut sont calculés par le serveur : les envoyer est refusé.
     *
     * @return array<string, list<mixed>>
     */
    public function rules(): array
    {
        return [
            'property_id' => ['required', 'uuid'],
            'unit_id' => ['nullable', 'uuid'],
            'lender_label' => ['required', 'string', 'min:2', 'max:120'],
            'contract_reference' => ['nullable', 'string', 'max:64', 'regex:/^[A-Za-z0-9 ._\/-]+$/'],
            'purpose' => ['required', Rule::enum(LoanPurpose::class)],
            'principal' => ['required', 'integer', 'min:1', 'max:100000000000'],
            'nominal_rate' => ['required', 'numeric', 'regex:/^\d{1,2}(\.\d{1,5})?$/', 'between:0,30'],
            'first_due_on' => ['required', 'date_format:Y-m-d', 'after_or_equal:1990-01-01', 'before:2100-01-01'],
            'term_months' => ['required', 'integer', 'min:1', 'max:600'],
            'deferral_kind' => ['nullable', Rule::enum(DeferralKind::class)],
            'deferral_months' => ['nullable', 'integer', 'min:0', 'max:599'],
            'insurance_mode' => ['nullable', Rule::enum(InsuranceMode::class)],
            'insurance_rate' => ['nullable', 'numeric', 'regex:/^\d{1,2}(\.\d{1,5})?$/', 'between:0,10'],
            'insurance_amount' => ['nullable', 'integer', 'min:0', 'max:100000000000'],
            'replaces_loan_id' => ['nullable', 'uuid'],
            'document' => ['nullable', 'file', 'max:10240'],
            'currency' => ['prohibited'],
            'status' => ['prohibited'],
            'schedule_source' => ['prohibited'],
            'monthly_payment' => ['prohibited'],
            'payment' => ['prohibited'],
            'interest' => ['prohibited'],
            'outstanding' => ['prohibited'],
            'schedule' => ['prohibited'],
        ];
    }

    public function toData(string $idempotencyKey): NewLoanData
    {
        $v = $this->validated();

        return new NewLoanData(
            (string) $v['property_id'], isset($v['unit_id']) ? (string) $v['unit_id'] : null, trim((string) $v['lender_label']),
            isset($v['contract_reference']) ? trim((string) $v['contract_reference']) : null, LoanPurpose::from((string) $v['purpose']),
            new LoanTermsData(
                (int) $v['principal'], (string) $v['nominal_rate'], (string) $v['first_due_on'], (int) $v['term_months'],
                DeferralKind::from((string) ($v['deferral_kind'] ?? 'none')), (int) ($v['deferral_months'] ?? 0),
                InsuranceMode::from((string) ($v['insurance_mode'] ?? 'none')), isset($v['insurance_rate']) ? (string) $v['insurance_rate'] : null,
                isset($v['insurance_amount']) ? (int) $v['insurance_amount'] : null,
            ),
            isset($v['replaces_loan_id']) ? (string) $v['replaces_loan_id'] : null, $this->file('document'), $idempotencyKey,
        );
    }
}
