<?php

declare(strict_types=1);

namespace App\Modules\Leases\Support;

use App\Modules\Leases\Enums\ErrorCode;
use App\Modules\Leases\Models\Lease;
use App\Modules\Leases\Models\LeaseUnit;
use App\Modules\Leases\Queries\UnitOccupations;

/**
 * Contrôle d'un changement de fin de bail qui prolonge l'occupation de ses lots : même verrou et même relecture que la
 * signature. Un bail dont la fin recule ou reste ouverte n'a rien à vérifier.
 */
final readonly class OccupationExtension
{
    public function __construct(
        private UnitOccupancyLock $verrou,
        private UnitOccupations $occupations,
    ) {}

    /**
     * À appeler dans la transaction, bail verrouillé, avant toute lecture non verrouillante des lots ou des baux.
     *
     * @param  string|null  $nouvelleFin  fin effective (exclue) que le bail aura après le changement
     */
    public function assertFree(Lease $bail, ?string $nouvelleFin): void
    {
        $ancienne = $bail->effectiveEnd();

        if ($ancienne === null || ($nouvelleFin !== null && $nouvelleFin <= $ancienne)) {
            return;
        }

        $lignes = LeaseUnit::query()
            ->where('lease_id', $bail->id)
            ->where(fn ($e) => $e->whereNull('valid_to')->orWhere('valid_to', '>', $ancienne))
            ->lockForUpdate()
            ->get();

        $lots = array_values(array_unique(array_map(fn (LeaseUnit $l): string => $l->unit_id, $lignes->all())));
        $this->verrou->acquire($lots);

        $autres = $this->occupations->of($lots, $bail->id);

        foreach ($lignes as $ligne) {
            $de = max($ligne->valid_from->toDateString(), $ancienne);
            $fins = array_filter([$ligne->valid_to?->toDateString(), $nouvelleFin], fn (?string $f): bool => $f !== null);
            $a = $fins === [] ? null : min($fins);

            if ($a !== null && $a <= $de) {
                continue;
            }

            foreach ($autres as $autre) {
                if ($autre['unit_id'] === $ligne->unit_id && $this->occupations->overlap($de, $a, $autre['from'], $autre['to'])) {
                    throw ErrorCode::LeaseOverlap->problem();
                }
            }
        }
    }
}
