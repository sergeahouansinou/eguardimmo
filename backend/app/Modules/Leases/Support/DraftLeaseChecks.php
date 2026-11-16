<?php

declare(strict_types=1);

namespace App\Modules\Leases\Support;

use App\Modules\Catalog\Enums\LeaseComponentSemantic;
use App\Modules\Catalog\Enums\VocabularyKey;
use App\Modules\Catalog\PublicApi\TermDirectory;
use App\Modules\Leases\Enums\ErrorCode;
use App\Modules\Leases\Jurisdictions\LeaseRegime;
use App\Modules\Leases\Models\Lease;
use App\Modules\Leases\Models\LeaseTerm;
use App\Modules\Leases\Models\LeaseUnit;
use App\Modules\Properties\PublicApi\UnitDirectory;
use Money\Money;

/**
 * Contrôles qui portent sur l'état final du brouillon, après écriture de ses lignes : à appeler dans la même transaction.
 */
final readonly class DraftLeaseChecks
{
    public function __construct(
        private UnitDirectory $lots,
        private TermDirectory $termes,
    ) {}

    public function assertConsistent(Lease $bail, LeaseRegime $regime): void
    {
        $this->assertUnitsFollowJurisdiction($bail);

        $lignes = LeaseTerm::query()->where('lease_id', $bail->id)->get();
        $debut = $bail->starts_on->toDateString();
        $fin = $bail->ends_on?->toDateString();

        foreach ($lignes as $ligne) {
            $depuis = $ligne->valid_from->toDateString();

            if ($depuis < $debut || ($fin !== null && $depuis >= $fin)) {
                throw ErrorCode::LeasePeriodInvalid->problem();
            }
        }

        $this->assertDepositWithinCap($bail, $regime, array_values($lignes->all()));
    }

    private function assertUnitsFollowJurisdiction(Lease $bail): void
    {
        $ids = LeaseUnit::query()->where('lease_id', $bail->id)->pluck('unit_id')->all();

        foreach ($this->lots->findMany(array_values(array_map(strval(...), $ids))) as $lot) {
            if ($lot->address['country'] !== $bail->jurisdiction) {
                throw ErrorCode::LeaseUnitNotAvailable->problem();
            }
        }
    }

    /**
     * Plafond : mois de loyer (`rent` en vigueur au début du bail) ; `null` : aucun plafond ; `0` : dépôt refusé.
     *
     * @param  list<LeaseTerm>  $lignes
     */
    private function assertDepositWithinCap(Lease $bail, LeaseRegime $regime, array $lignes): void
    {
        $mois = $regime->depositCapMonths($bail->jurisdiction_data);

        if ($mois === null) {
            return;
        }

        $devise = DraftCurrency::of($bail);
        $loyer = new Money(0, $devise);
        $depot = new Money(0, $devise);
        $debut = $bail->starts_on->toDateString();
        $sens = [];

        foreach ($lignes as $ligne) {
            $sens[$ligne->component_term_id] ??= $this->termes->find($ligne->component_term_id, VocabularyKey::LeaseComponent)->semanticKey;
            $enVigueur = $ligne->valid_from->toDateString() <= $debut && ($ligne->valid_to === null || $ligne->valid_to->toDateString() > $debut);

            if ($sens[$ligne->component_term_id] === LeaseComponentSemantic::Rent->value && $enVigueur) {
                $loyer = $loyer->add($ligne->amount);
            }

            if ($sens[$ligne->component_term_id] === LeaseComponentSemantic::Deposit->value) {
                $depot = $depot->add($ligne->amount);
            }
        }

        if ($depot->greaterThan($loyer->multiply($mois))) {
            throw ErrorCode::LeaseDepositOverCap->problem();
        }
    }
}
