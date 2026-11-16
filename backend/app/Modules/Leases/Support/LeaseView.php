<?php

declare(strict_types=1);

namespace App\Modules\Leases\Support;

use App\Modules\Catalog\Data\TermData;
use App\Modules\Leases\Enums\LeasePartyRole;
use App\Modules\Leases\Enums\LeasePhase;
use App\Modules\Leases\Models\Lease;
use App\Modules\Leases\Models\LeaseParty;
use App\Modules\Leases\Models\LeaseTerm;
use App\Modules\Leases\Models\LeaseUnit;
use App\Modules\Parties\Data\PartyData;
use App\Modules\Properties\Data\UnitData;
use Carbon\CarbonInterface;

/**
 * Un bail et tout ce qu'il faut pour le présenter, résolu en une fois : aucune lecture n'a lieu dans les Resources.
 */
final readonly class LeaseView
{
    /**
     * @param  list<LeaseUnit>  $units
     * @param  list<LeaseParty>  $parties
     * @param  list<LeaseTerm>  $terms
     * @param  array<string, UnitData>  $unitData  par identifiant de lot
     * @param  array<string, PartyData>  $partyData  par identifiant de partie
     * @param  array<string, TermData>  $components  par identifiant de composante
     */
    public function __construct(
        public Lease $lease,
        public LeasePhase $phase,
        public CarbonInterface $today,
        public array $units = [],
        public array $parties = [],
        public array $terms = [],
        public array $unitData = [],
        public array $partyData = [],
        public array $components = [],
        public ?CarbonInterface $termsDay = null,
    ) {}

    /**
     * Période semi-ouverte : la fin est exclue.
     */
    public static function covers(CarbonInterface $from, ?CarbonInterface $to, CarbonInterface $day): bool
    {
        $jour = $day->toDateString();

        return $from->toDateString() <= $jour && ($to === null || $to->toDateString() > $jour);
    }

    /**
     * Le lot principal en vigueur, à défaut le dernier connu.
     *
     * @param  iterable<LeaseUnit>  $units
     */
    public static function mainOf(iterable $units, CarbonInterface $day): ?LeaseUnit
    {
        $retenu = null;

        foreach ($units as $unite) {
            if (! $unite->is_main) {
                continue;
            }

            if (self::covers($unite->valid_from, $unite->valid_to, $day)) {
                return $unite;
            }

            if ($retenu === null || $unite->valid_from->toDateString() > $retenu->valid_from->toDateString()) {
                $retenu = $unite;
            }
        }

        return $retenu;
    }

    public function mainUnit(): ?LeaseUnit
    {
        return self::mainOf($this->units, $this->today);
    }

    /**
     * Locataires en vigueur, à défaut tous ceux que le bail a connus.
     *
     * @return list<LeaseParty>
     */
    public function tenants(): array
    {
        $locataires = array_values(array_filter($this->parties, fn (LeaseParty $p): bool => $p->role === LeasePartyRole::Tenant));
        $enVigueur = array_values(array_filter($locataires, fn (LeaseParty $p): bool => self::covers($p->valid_from, $p->valid_to, $this->today)));

        return $enVigueur !== [] ? $enVigueur : $locataires;
    }

    public function termIsInForce(LeaseTerm $terme): bool
    {
        return self::covers($terme->valid_from, $terme->valid_to, $this->termsDay ?? $this->today);
    }
}
