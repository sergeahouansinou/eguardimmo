<?php

declare(strict_types=1);

namespace App\Modules\Banking\Support;

use App\Modules\Banking\Data\StatementGapData;
use App\Modules\Banking\Models\BankStatement;
use Carbon\CarbonImmutable;

/**
 * Trous de continuité d'un compte, calculés à la volée sur les relevés vivants (ni annulés ni copies) qui portent leurs soldes.
 */
final class StatementGaps
{
    /**
     * @return list<StatementGapData>
     */
    public function of(string $accountId, ?CarbonImmutable $upTo = null): array
    {
        $releves = BankStatement::query()
            ->where('bank_account_id', $accountId)->whereNull('voided_at')->where('is_copy', false)
            ->whereNotNull('opening_balance')->whereNotNull('closing_balance')
            ->orderBy('period_from')->orderBy('period_to')->orderBy('id')
            ->get();

        $trous = [];
        $precedent = null;

        foreach ($releves as $releve) {
            if ($upTo !== null && $releve->period_from->greaterThan($upTo)) {
                break;
            }

            $ouverture = $releve->opening_balance?->getAmount();
            $cloture = $precedent?->closing_balance?->getAmount();

            if ($precedent !== null && $releve->period_from->greaterThan($precedent->period_to) && $ouverture !== null && $cloture !== null && $ouverture !== $cloture) {
                $trous[] = new StatementGapData($precedent->id, $releve->id, $releve->period_from, (int) $cloture, (int) $ouverture);
            }

            if ($precedent === null || $releve->period_to->greaterThanOrEqualTo($precedent->period_to)) {
                $precedent = $releve;
            }
        }

        return $trous;
    }
}
