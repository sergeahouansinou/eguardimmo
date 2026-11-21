<?php

declare(strict_types=1);

namespace App\Modules\Rent\PublicApi;

use App\Modules\Rent\Actions\CancelPendingAdjustments;
use App\Modules\Rent\Actions\CreditAdjustment;
use App\Modules\Rent\Actions\ScheduleAdjustments;
use App\Modules\Rent\Data\AdjustmentCreditData;
use App\Modules\Rent\Data\AdjustmentLineData;
use App\Modules\Rent\Data\ScheduledAdjustmentData;
use App\Modules\Rent\Queries\AdjustmentEffects;
use Carbon\CarbonImmutable;
use Money\Money;

/**
 * Écriture des régularisations de charges dans le compte du locataire (ADR 0034) : dans la transaction de l'appelant, sous
 * le contexte d'organisation, après le verrou de son décompte. Rent ne modifie aucune échéance déjà générée.
 */
final readonly class RentAdjustments
{
    public function __construct(
        private ScheduleAdjustments $programmation,
        private CreditAdjustment $creditation,
        private CancelPendingAdjustments $retrait,
        private AdjustmentEffects $effets,
    ) {}

    /**
     * Lignes positives : facturées sur la première échéance générée dont la période commence au plus tôt à `notBefore`, ou
     * échéance ponctuelle quand le bail est terminé. Le mandat et le mandant servent à figer l'échéance ponctuelle.
     *
     * @param  list<AdjustmentLineData>  $lines
     * @return list<ScheduledAdjustmentData>
     */
    public function schedule(string $leaseId, string $sourceId, array $lines, ?string $mandateId, ?string $mandantPartyId, ?CarbonImmutable $today = null): array
    {
        return $this->programmation->handle($leaseId, $sourceId, $lines, $mandateId, $mandantPartyId, $today ?? CarbonImmutable::today());
    }

    /**
     * Solde négatif : avance du bail reprise à l'avis suivant. Écriture `charges:statement:{id}:credit`, rejouable.
     */
    public function credit(string $leaseId, string $statementId, Money $amount, ?string $unitId, ?string $mandantPartyId, ?CarbonImmutable $date = null): AdjustmentCreditData
    {
        return $this->creditation->handle($leaseId, $statementId, $amount, $unitId, $mandantPartyId, $date ?? CarbonImmutable::today());
    }

    /**
     * Retire les lignes encore en attente d'une source ; 409 `rent_adjustment_billed` si l'une figure déjà sur une échéance.
     */
    public function cancelPending(string $leaseId, string $sourceId): int
    {
        return $this->retrait->handle($leaseId, $sourceId);
    }

    /**
     * Parmi ces décomptes, ceux qui ont une ligne de régularisation ou un crédit dans le compte du locataire (contrôle de cohérence).
     *
     * @param  list<string>  $statementIds
     * @return list<string>
     */
    public function statementsWithEffect(array $statementIds): array
    {
        return $this->effets->ofStatements($statementIds);
    }
}
