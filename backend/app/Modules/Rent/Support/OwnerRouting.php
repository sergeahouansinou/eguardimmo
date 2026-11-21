<?php

declare(strict_types=1);

namespace App\Modules\Rent\Support;

use App\Modules\Accounting\PublicApi\LedgerReader;
use App\Modules\Mandates\PublicApi\MandateDirectory;
use App\Modules\Rent\Models\Installment;

/**
 * Routage d'un loyer vers les fonds du mandant (ADR 0031) : décidé une fois, à l'émission de l'avis, d'après le mandat
 * qui couvre le lot au premier jour de la période, puis figé sur l'échéance. Sans date d'activation, rien ne change.
 */
final readonly class OwnerRouting
{
    public function __construct(
        private LedgerReader $lecteur,
        private MandateDirectory $mandats,
    ) {}

    public function freeze(Installment $echeance): void
    {
        if ($echeance->mandate_id !== null || $echeance->unit_id === null || $this->lecteur->ownerFundsCutoverAt() === null) {
            return;
        }

        $couverture = $this->mandats->coveringUnit($echeance->unit_id, $echeance->period_start);

        if ($couverture === null) {
            return;
        }

        $echeance->mandate_id = $couverture->mandateId;
        $echeance->mandant_party_id = $couverture->mandantPartyId;
        $echeance->save();
    }

    public function leaseIsRouted(string $leaseId): bool
    {
        return Installment::query()->where('lease_id', $leaseId)->whereNotNull('mandant_party_id')->exists();
    }
}
