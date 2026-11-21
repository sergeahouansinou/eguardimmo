<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Http\Requests;

use App\Modules\Mandates\Data\AmendMandateTermsData;
use App\Modules\Mandates\Enums\FeeBase;
use App\Modules\Mandates\Enums\FeeKind;
use App\Modules\Mandates\Enums\FeeTaxMode;
use App\Modules\Mandates\Http\Support\MandateInput;
use Closure;
use Illuminate\Contracts\Validation\Validator;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class AmendMandateTermsRequest extends FormRequest
{
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
            'lock_version' => ['required', 'integer', 'min:1'],
            'effective_on' => ['required', 'date_format:Y-m-d', 'after_or_equal:today', 'before_or_equal:2200-12-31'],
            'signed_file_id' => ['nullable', 'uuid'],
            'fee_kind' => ['nullable', Rule::enum(FeeKind::class)],
            'fee_basis_points' => ['nullable', 'integer', 'between:0,10000'],
            'fee_flat_amount' => ['nullable', 'integer', 'min:0', 'max:'.MandateInput::MAX_AMOUNT],
            'payout_day' => ['nullable', 'integer', 'between:1,28'],
            'works_limit_amount' => ['nullable', 'integer', 'min:0', 'max:'.MandateInput::MAX_AMOUNT],
            'fee_base' => ['nullable', Rule::enum(FeeBase::class)],
            'fee_minimum_amount' => ['nullable', 'integer', 'min:0', 'max:'.MandateInput::MAX_AMOUNT],
            'fee_tax_mode' => ['nullable', Rule::enum(FeeTaxMode::class)],
            'letting_fee_basis_points' => ['sometimes', 'nullable', 'integer', 'between:0,10000'],
            'works_fee_basis_points' => ['sometimes', 'nullable', 'integer', 'between:0,10000'],
        ];
    }

    /**
     * @return list<Closure(Validator): void>
     */
    public function after(): array
    {
        return [function (Validator $validateur): void {
            $champs = ['fee_kind', 'fee_basis_points', 'fee_flat_amount', 'payout_day', 'works_limit_amount', 'fee_base', 'fee_minimum_amount', 'fee_tax_mode'];
            $presents = array_filter($champs, fn (string $champ): bool => $this->filled($champ)) !== []
                || $this->has('letting_fee_basis_points') || $this->has('works_fee_basis_points');

            if (! $presents && ! $validateur->errors()->has('fee_kind')) {
                $validateur->errors()->add('fee_kind', 'Un avenant modifie au moins une condition.');
            }
        }];
    }

    public function toData(): AmendMandateTermsData
    {
        /** @var array<string, mixed> $v */
        $v = $this->validated();
        $entier = fn (string $cle): ?int => isset($v[$cle]) ? (int) $v[$cle] : null;

        return new AmendMandateTermsData(
            lockVersion: (int) $v['lock_version'],
            effectiveOn: (string) $v['effective_on'],
            feeKind: isset($v['fee_kind']) ? FeeKind::from((string) $v['fee_kind']) : null,
            feeBasisPoints: $entier('fee_basis_points'),
            feeFlatAmount: $entier('fee_flat_amount'),
            payoutDay: $entier('payout_day'),
            worksLimitAmount: $entier('works_limit_amount'),
            feeBase: isset($v['fee_base']) ? FeeBase::from((string) $v['fee_base']) : null,
            feeMinimumAmount: $entier('fee_minimum_amount'),
            feeTaxMode: isset($v['fee_tax_mode']) ? FeeTaxMode::from((string) $v['fee_tax_mode']) : null,
            signedFileId: isset($v['signed_file_id']) ? (string) $v['signed_file_id'] : null,
            lettingFeeChanged: array_key_exists('letting_fee_basis_points', $v),
            lettingFeeBasisPoints: $entier('letting_fee_basis_points'),
            worksFeeChanged: array_key_exists('works_fee_basis_points', $v),
            worksFeeBasisPoints: $entier('works_fee_basis_points'),
        );
    }
}
