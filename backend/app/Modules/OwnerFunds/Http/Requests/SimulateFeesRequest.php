<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Http\Requests;

use App\Modules\Mandates\Enums\FeeBase;
use App\Modules\Mandates\Enums\FeeKind;
use App\Modules\Mandates\Enums\FeeTaxMode;
use App\Modules\OwnerFunds\Data\FeeProposalData;
use App\Modules\OwnerFunds\Enums\ErrorCode;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class SimulateFeesRequest extends FormRequest
{
    private const int MAX_AMOUNT = 100_000_000_000;

    private const int DEFAULT_MONTHS = 3;

    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, list<mixed>>
     */
    public function rules(): array
    {
        return [
            'mandate_id' => ['required', 'uuid'],
            'fee_kind' => ['required', Rule::enum(FeeKind::class)],
            'fee_basis_points' => ['required_if:fee_kind,percentage', 'prohibited_unless:fee_kind,percentage', 'nullable', 'integer', 'between:0,10000'],
            'fee_flat_amount' => ['required_if:fee_kind,flat', 'prohibited_unless:fee_kind,flat', 'nullable', 'integer', 'min:0', 'max:'.self::MAX_AMOUNT],
            'fee_base' => ['nullable', Rule::enum(FeeBase::class)],
            'fee_minimum_amount' => ['sometimes', 'integer', 'min:0', 'max:'.self::MAX_AMOUNT],
            'fee_tax_mode' => ['sometimes', Rule::enum(FeeTaxMode::class)],
            'months' => ['sometimes', 'integer', 'between:1,12'],
        ];
    }

    public function mandateId(): string
    {
        return (string) $this->validated('mandate_id');
    }

    public function months(): int
    {
        return (int) ($this->validated('months') ?? self::DEFAULT_MONTHS);
    }

    public function proposal(): FeeProposalData
    {
        $v = $this->validated();

        if (! isset($v['fee_base'])) {
            throw ErrorCode::FeeBaseMissing->problem('Le barème proposé n\'indique pas la base des honoraires.');
        }

        return new FeeProposalData(
            FeeKind::from((string) $v['fee_kind']),
            isset($v['fee_basis_points']) ? (int) $v['fee_basis_points'] : null,
            isset($v['fee_flat_amount']) ? (int) $v['fee_flat_amount'] : null,
            FeeBase::from((string) $v['fee_base']),
            (int) ($v['fee_minimum_amount'] ?? 0),
            isset($v['fee_tax_mode']) ? FeeTaxMode::from((string) $v['fee_tax_mode']) : FeeTaxMode::ExclTax,
        );
    }
}
