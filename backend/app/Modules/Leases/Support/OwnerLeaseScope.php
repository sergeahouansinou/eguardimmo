<?php

declare(strict_types=1);

namespace App\Modules\Leases\Support;

use App\Modules\Leases\Models\Lease;
use App\Modules\Leases\Models\LeaseParty;
use App\Modules\Leases\Models\LeaseUnit;
use App\Modules\Mandates\Data\OwnerCoverageData;
use Carbon\CarbonImmutable;

/**
 * Ce qu'un compte propriétaire peut voir d'un bail (ADR 0032) : les périodes où un lot du bail était couvert par son mandant.
 * Le jour de référence ne dépasse jamais la dernière de ces périodes : un lot passé à un autre mandant, un loyer révisé,
 * un colocataire ou un congé postérieurs ne se lisent pas. Un lot hors de la clé n'est jamais servi.
 */
final readonly class OwnerLeaseScope
{
    private const string SANS_FIN = '9999-12-31';

    /**
     * @param  list<LeaseUnit>  $units  lots de la clé dont la période croise la couverture
     * @param  list<array{from: string, to: string}>  $windows  périodes lisibles, bornes incluses
     */
    private function __construct(
        public CarbonImmutable $day,
        public array $units,
        private array $windows,
        public bool $foreignUnits,
    ) {}

    /**
     * @param  iterable<LeaseUnit>  $lignes  toutes les lignes de lot du bail
     * @param  list<OwnerCoverageData>  $couvertures  celles du compte dans l'organisation du bail
     */
    public static function of(Lease $bail, iterable $lignes, array $couvertures, CarbonImmutable $today): self
    {
        $lignes = [...$lignes];
        $debutBail = $bail->starts_on->toDateString();
        $finBail = $bail->ends_on === null ? self::SANS_FIN : CarbonImmutable::parse($bail->ends_on->toDateString())->subDay()->toDateString();
        $fenetres = [];
        $retenues = [];

        foreach ($lignes as $ligne) {
            $debut = $ligne->valid_from->toDateString();
            $fin = $ligne->valid_to === null ? self::SANS_FIN : CarbonImmutable::parse($ligne->valid_to->toDateString())->subDay()->toDateString();

            foreach ($couvertures as $couverture) {
                if ($couverture->unitId !== $ligne->unit_id) {
                    continue;
                }

                $de = max($couverture->from, $debut, $debutBail);
                $a = min($couverture->to, $fin, $finBail);

                if ($de <= $a) {
                    $fenetres[] = ['from' => $de, 'to' => $a];
                    $retenues[$ligne->id] = $ligne;
                }
            }
        }

        $jour = $today->toDateString();

        if ($fenetres !== []) {
            $jour = max(min($jour, max(array_column($fenetres, 'to'))), min(array_column($fenetres, 'from')));
        }

        $hors = array_filter($lignes, fn (LeaseUnit $l): bool => $l->valid_from->toDateString() <= $jour
            && ($l->valid_to === null || $l->valid_to->toDateString() > $jour)
            && ! array_filter($couvertures, fn (OwnerCoverageData $c): bool => $c->unitId === $l->unit_id && $c->from <= $jour && $c->to >= $jour));

        return new self(CarbonImmutable::parse($jour), array_values($retenues), $fenetres, $hors !== []);
    }

    public function keepsParty(LeaseParty $ligne): bool
    {
        $debut = $ligne->valid_from->toDateString();
        $fin = $ligne->valid_to?->toDateString();

        foreach ($this->windows as $fenetre) {
            if ($debut <= $fenetre['to'] && ($fin === null || $fin > $fenetre['from'])) {
                return true;
            }
        }

        return false;
    }

    public function noticeVisible(Lease $bail): bool
    {
        return $bail->notice_received_on !== null && $bail->notice_received_on->toDateString() <= $this->day->toDateString();
    }

    /**
     * Fin exclue du bail telle que le compte peut la connaître : sans le départ préavisé d'un congé hors couverture.
     */
    public function end(Lease $bail): ?string
    {
        return $this->noticeVisible($bail) ? $bail->effectiveEnd() : $bail->ends_on?->toDateString();
    }
}
