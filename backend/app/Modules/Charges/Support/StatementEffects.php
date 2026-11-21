<?php

declare(strict_types=1);

namespace App\Modules\Charges\Support;

use App\Modules\Charges\Enums\StatementSettlement;
use App\Modules\Charges\Jurisdictions\ChargeRules;
use App\Modules\Charges\Models\ChargeStatement;
use App\Modules\Rent\Data\AdjustmentLineData;
use App\Modules\Rent\PublicApi\RentAdjustments;
use Carbon\CarbonImmutable;
use Money\Money;

/**
 * Effet d'un décompte émis sur le compte du locataire (ADR 0034 § 6) : tout passe par Rent, sous le verrou du décompte.
 */
final readonly class StatementEffects
{
    public function __construct(private RentAdjustments $rent) {}

    /**
     * @param  int  $delta  solde à porter : le solde du décompte, ou sa différence avec le décompte rectifié
     * @return array{settlement: StatementSettlement, not_before: string|null}
     */
    public function apply(ChargeStatement $decompte, ChargeRules $regles, int $delta, string $unitId, CarbonImmutable $today, CarbonImmutable $debut, CarbonImmutable $fin): array
    {
        $devise = Currencies::of($decompte->currency);

        if ($delta === 0) {
            return ['settlement' => StatementSettlement::None, 'not_before' => null];
        }

        if ($delta < 0) {
            $this->rent->credit($decompte->lease_id, $decompte->id, new Money(-$delta, $devise), $unitId, $decompte->mandant_party_id, $today);

            return ['settlement' => StatementSettlement::Credit, 'not_before' => null];
        }

        $pasAvant = $today->addMonths($regles->dueDelayMonths($today))->startOfDay();
        $libelle = sprintf('Régularisation des charges du %s au %s', $debut->format('d/m/Y'), $fin->subDay()->format('d/m/Y'));
        $resultat = $this->rent->schedule($decompte->lease_id, $decompte->id, [new AdjustmentLineData(1, new Money($delta, $devise), $libelle, $pasAvant)], $decompte->mandate_id, $decompte->mandant_party_id, $today);

        return ['settlement' => $resultat[0]->mode === 'installment' ? StatementSettlement::StandaloneInstallment : StatementSettlement::NextInstallments, 'not_before' => $pasAvant->toDateString()];
    }
}
