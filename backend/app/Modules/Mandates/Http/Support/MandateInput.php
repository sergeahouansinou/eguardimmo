<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Http\Support;

use App\Modules\Mandates\Data\NewMandateTermData;
use App\Modules\Mandates\Data\NewMandateUnitData;
use App\Modules\Mandates\Enums\FeeBase;
use App\Modules\Mandates\Enums\FeeKind;
use App\Modules\Mandates\Enums\FeeTaxMode;
use Illuminate\Validation\Rule;
use Money\Currencies\ISOCurrencies;

/**
 * Règles et lecture des blocs `terms` et `units`, communs à la création et à la modification d'un brouillon.
 */
final class MandateInput
{
    public const int MAX_AMOUNT = 100_000_000_000;

    /**
     * Sans préfixe, les règles portent sur un corps à plat (défauts d'organisation) ; `$presence` vaut `required_with:{préfixe}`
     * pour un bloc `terms` facultatif, `required` pour un corps à plat.
     *
     * @return array<string, list<mixed>>
     */
    public static function termRules(string $prefixe = 'terms'): array
    {
        $cle = fn (string $champ): string => $prefixe === '' ? $champ : "{$prefixe}.{$champ}";
        $presence = $prefixe === '' ? 'required' : 'required_with:'.$prefixe;

        return [
            ...($prefixe === '' ? [] : [$prefixe => ['array']]),
            $cle('fee_kind') => [$presence, Rule::enum(FeeKind::class)],
            $cle('fee_basis_points') => ['required_if:'.$cle('fee_kind').',percentage', 'prohibited_unless:'.$cle('fee_kind').',percentage', 'integer', 'between:0,10000'],
            $cle('fee_flat_amount') => ['required_if:'.$cle('fee_kind').',flat', 'prohibited_unless:'.$cle('fee_kind').',flat', 'integer', 'min:0', 'max:'.self::MAX_AMOUNT],
            $cle('payout_day') => [$presence, 'integer', 'between:1,28'],
            $cle('works_limit_amount') => ['sometimes', 'integer', 'min:0', 'max:'.self::MAX_AMOUNT],
            $cle('fee_base') => [$presence, Rule::enum(FeeBase::class)],
            $cle('fee_minimum_amount') => ['sometimes', 'integer', 'min:0', 'max:'.self::MAX_AMOUNT],
            $cle('fee_tax_mode') => ['sometimes', Rule::enum(FeeTaxMode::class)],
            $cle('letting_fee_basis_points') => ['sometimes', 'nullable', 'integer', 'between:0,10000'],
            $cle('works_fee_basis_points') => ['sometimes', 'nullable', 'integer', 'between:0,10000'],
        ];
    }

    /**
     * @return array<string, list<mixed>>
     */
    public static function unitRules(): array
    {
        return [
            'units' => ['array', 'min:1', 'max:50'],
            'units.*.unit_id' => ['required', 'uuid', 'distinct'],
            'units.*.valid_from' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:2000-01-01', 'before_or_equal:2200-12-31'],
        ];
    }

    /**
     * @return list<string>
     */
    public static function currencies(): array
    {
        $codes = [];

        foreach (new ISOCurrencies as $devise) {
            $codes[] = $devise->getCode();
        }

        return $codes;
    }

    /**
     * @param  array<string, mixed>  $v
     */
    public static function terms(array $v): NewMandateTermData
    {
        /** @var array<string, mixed> $t */
        $t = $v['terms'];

        return self::termsFrom($t);
    }

    /**
     * @param  array<string, mixed>  $t
     */
    public static function termsFrom(array $t): NewMandateTermData
    {
        return new NewMandateTermData(
            feeKind: FeeKind::from((string) $t['fee_kind']),
            feeBasisPoints: isset($t['fee_basis_points']) ? (int) $t['fee_basis_points'] : null,
            feeFlatAmount: isset($t['fee_flat_amount']) ? (int) $t['fee_flat_amount'] : null,
            payoutDay: (int) $t['payout_day'],
            worksLimitAmount: (int) ($t['works_limit_amount'] ?? 0),
            feeBase: FeeBase::from((string) $t['fee_base']),
            feeMinimumAmount: (int) ($t['fee_minimum_amount'] ?? 0),
            feeTaxMode: isset($t['fee_tax_mode']) ? FeeTaxMode::from((string) $t['fee_tax_mode']) : FeeTaxMode::ExclTax,
            lettingFeeBasisPoints: isset($t['letting_fee_basis_points']) ? (int) $t['letting_fee_basis_points'] : null,
            worksFeeBasisPoints: isset($t['works_fee_basis_points']) ? (int) $t['works_fee_basis_points'] : null,
        );
    }

    /**
     * @param  array<string, mixed>  $v
     * @return list<NewMandateUnitData>
     */
    public static function units(array $v): array
    {
        /** @var list<array<string, mixed>> $lots */
        $lots = array_values((array) ($v['units'] ?? []));

        return array_map(
            fn (array $l): NewMandateUnitData => new NewMandateUnitData((string) $l['unit_id'], isset($l['valid_from']) ? (string) $l['valid_from'] : null),
            $lots,
        );
    }
}
