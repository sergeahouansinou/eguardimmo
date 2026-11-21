<?php

declare(strict_types=1);

namespace App\Modules\Tax\Http\Support;

use App\Modules\Tax\Support\SummaryText;

/**
 * Rend un instantané de calcul (vivant ou figé) en réponse JSON : montants `{amount, currency}` en unités mineures, messages en français.
 * Jamais d'identifiant de bien, de pièce de dépense ou de prêt dans une réponse mandant : `$withRefs` à faux les retire.
 */
final class IncomeView
{
    /**
     * @param  array<string, mixed>  $s
     * @return array<string, mixed>
     */
    public static function render(array $s, bool $provisional, bool $withRefs = true): array
    {
        $devise = (string) $s['currency'];
        $m = fn (int $montant): array => ['amount' => $montant, 'currency' => $devise];
        $ligne = fn (array $l): array => [
            'code' => $l['code'],
            'label' => $l['label'],
            'status' => $l['status'],
            'exact' => $m((int) $l['exact']),
            'rounded' => $m((int) $l['rounded']),
            'sources' => array_map(fn (array $src): array => ['kind' => $src['kind'], 'ref' => $withRefs ? $src['ref'] : null, 'amount' => $m((int) $src['amount'])], $l['sources'] ?? []),
            'sources_truncated' => (bool) ($l['sources_truncated'] ?? false),
        ];
        $micro = $s['micro'];
        $deficit = $s['deficit'] ?? null;

        return [
            'income_year' => $s['income_year'],
            'form_version' => $s['form_version'],
            'currency' => $devise,
            'provisional' => $provisional,
            'household_complete' => (bool) $s['household_complete'],
            'properties' => array_map(fn (array $b): array => [
                'property_id' => $withRefs ? $b['property_id'] : null,
                'name' => $b['name'],
                'premises' => $b['premises'],
                'co_owners' => $b['co_owners'],
                'lines' => array_map($ligne, $b['lines']),
            ], $s['properties']),
            'totals' => array_map($ligne, $s['totals']),
            'micro' => [
                'gross_receipts' => $m((int) $micro['gross_receipts']),
                'allowance_bp' => $micro['allowance_bp'],
                'base_after_allowance' => $m((int) $micro['base_after_allowance']),
                'threshold' => $m((int) $micro['threshold']),
                'real_base' => $m((int) $micro['real_base']),
            ],
            'deficit' => $deficit === null ? null : [
                'result' => $m((int) $deficit['result']),
                'interest_part' => $m((int) $deficit['interest_part']),
                'other_part' => $m((int) $deficit['other_part']),
                'imputable_on_global_income' => $m((int) $deficit['imputable_on_global_income']),
                'carried_forward' => $m((int) $deficit['carried_forward']),
            ],
            'warnings' => array_map(fn (array $w): array => ['code' => $w['code'], 'property_id' => $withRefs ? ($w['property_id'] ?? null) : null, 'message' => SummaryText::messages([$w], SummaryText::minorPerMajor($devise))[0] ?? null], $s['warnings']),
            'warning' => $s['warning'],
            'mentions' => $s['mentions'],
        ];
    }
}
