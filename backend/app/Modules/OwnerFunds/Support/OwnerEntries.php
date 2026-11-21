<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Support;

use App\Modules\Accounting\Data\EntryData;
use App\Modules\Accounting\Data\LineData;
use App\Modules\Accounting\Enums\AccountRole;
use App\Modules\Accounting\Enums\Journal;
use App\Modules\Accounting\Enums\OnClosedPeriod;
use App\Modules\Accounting\Enums\SourceType;
use App\Modules\OwnerFunds\Enums\TrustTransferDirection;
use App\Modules\OwnerFunds\Models\PayoutItem;
use Carbon\CarbonImmutable;
use Money\Money;

/**
 * Écritures du grand livre de la décision 2 de l'ADR 0031 : une écriture, une clé d'idempotence.
 */
final class OwnerEntries
{
    public function validation(PayoutItem $element, CarbonImmutable $date): EntryData
    {
        return new EntryData(
            Journal::Bank, $date, 'Reversement validé', SourceType::OwnerPayout, $element->id,
            "owner_funds:payout:{$element->id}:validate",
            [
                LineData::debit(AccountRole::OwnerPayable, $element->net_amount, null, $element->mandant_party_id),
                LineData::credit(AccountRole::PayoutsInTransit, $element->net_amount, null, $element->mandant_party_id),
            ],
        );
    }

    public function execution(PayoutItem $element, string $numero, CarbonImmutable $date): EntryData
    {
        return new EntryData(
            Journal::Bank, $date, "Reversement {$numero} exécuté", SourceType::OwnerPayout, $element->id,
            "owner_funds:payout:{$element->id}:execute",
            [
                LineData::debit(AccountRole::PayoutsInTransit, $element->net_amount, null, $element->mandant_party_id),
                LineData::credit(AccountRole::TrustBank, $element->net_amount, null, $element->mandant_party_id),
            ],
            OnClosedPeriod::RollForward,
        );
    }

    public function transfer(string $virementId, TrustTransferDirection $sens, Money $montant, CarbonImmutable $date): EntryData
    {
        $retrait = $sens === TrustTransferDirection::WithdrawFees;

        return new EntryData(
            Journal::Bank, $date,
            $retrait ? 'Prélèvement des honoraires sur le compte de tiers' : 'Apport au compte de tiers',
            SourceType::TrustTransfer, $virementId, "owner_funds:trust_transfer:{$virementId}",
            [
                $retrait ? LineData::debit(AccountRole::Bank, $montant) : LineData::debit(AccountRole::TrustBank, $montant),
                $retrait ? LineData::credit(AccountRole::TrustBank, $montant) : LineData::credit(AccountRole::Bank, $montant),
            ],
            OnClosedPeriod::RollForward,
        );
    }
}
