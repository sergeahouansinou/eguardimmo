<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Support;

use App\Modules\Catalog\Data\TermData;
use App\Modules\Mandates\Models\Mandate;
use App\Modules\Mandates\Models\MandateTerm;
use App\Modules\Mandates\Models\MandateUnit;
use App\Modules\Parties\Data\PartyData;
use App\Modules\Properties\Data\UnitData;

/**
 * Un mandat avec ses lignes et les données des autres modules, lues en lot pour que la sortie n'interroge plus la base.
 */
final readonly class MandateView
{
    /**
     * @param  list<MandateUnit>  $units
     * @param  list<MandateTerm>  $terms  conditions successives, la plus ancienne d'abord
     * @param  array<string, UnitData>  $unitData
     */
    public function __construct(
        public Mandate $mandate,
        public array $units,
        public array $terms,
        public PartyData $mandant,
        public TermData $type,
        public array $unitData,
        public bool $hasEndRequest = false,
    ) {}

    /**
     * Conditions en vigueur à ce jour, sinon les plus récentes.
     */
    public function termsAt(string $jour): ?MandateTerm
    {
        $enVigueur = array_values(array_filter(
            $this->terms,
            fn (MandateTerm $t): bool => $t->valid_from->toDateString() <= $jour && ($t->valid_to === null || $t->valid_to->toDateString() > $jour),
        ));

        return $enVigueur[0] ?? ($this->terms === [] ? null : $this->terms[count($this->terms) - 1]);
    }
}
