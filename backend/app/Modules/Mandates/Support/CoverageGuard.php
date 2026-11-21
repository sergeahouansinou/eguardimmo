<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Support;

use App\Modules\Mandates\Enums\ErrorCode;
use App\Modules\Mandates\Models\Mandate;
use App\Modules\Mandates\Models\MandateUnit;
use App\Modules\Mandates\Queries\UnitCoverages;

/**
 * Anti-chevauchement : un lot n'a qu'un mandat à la fois dans une organisation (ADR 0017 : verrou ordonné, pas de contrainte native).
 */
final readonly class CoverageGuard
{
    public function __construct(
        private UnitCoverageLock $verrou,
        private UnitCoverages $couvertures,
    ) {}

    /**
     * Verrouille les lots puis vérifie qu'aucun autre mandat ne les couvre sur la période des lignes. Aucune lecture non
     * verrouillante de la transaction ne doit précéder cet appel : sous REPEATABLE READ elle figerait l'instantané.
     *
     * @param  list<MandateUnit>  $lignes
     */
    public function assertFree(Mandate $mandat, array $lignes): void
    {
        $this->verrou->acquire(array_map(fn (MandateUnit $l): string => $l->unit_id, $lignes));

        $existantes = $this->couvertures->of(array_map(fn (MandateUnit $l): string => $l->unit_id, $lignes), $mandat->id);

        foreach ($lignes as $ligne) {
            $periode = $this->couvertures->period($ligne->valid_from->toDateString(), $ligne->valid_to?->toDateString(), $mandat);

            if ($periode === null) {
                continue;
            }

            foreach ($existantes as $autre) {
                if ($autre['unit_id'] === $ligne->unit_id && $this->couvertures->overlap($periode['from'], $periode['to'], $autre['from'], $autre['to'])) {
                    throw ErrorCode::MandateOverlap->problem();
                }
            }
        }
    }
}
