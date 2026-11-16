<?php

declare(strict_types=1);

namespace App\Modules\Leases\Actions;

use App\Modules\Leases\Data\NewLeaseUnitChangeData;
use App\Modules\Leases\Enums\ErrorCode;
use App\Modules\Leases\Enums\LeaseStatus;
use App\Modules\Leases\Models\Lease;
use App\Modules\Leases\Models\LeaseUnit;
use App\Modules\Leases\Queries\Leases;
use App\Modules\Leases\Queries\UnitOccupations;
use App\Modules\Leases\Support\UnitOccupancyLock;
use App\Modules\Properties\PublicApi\UnitDirectory;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;

final readonly class AddLeaseUnit
{
    public function __construct(
        private Leases $baux,
        private UnitOccupancyLock $verrou,
        private UnitOccupations $occupations,
        private UnitDirectory $lots,
        private RecordAudit $audit,
    ) {}

    /**
     * Pour un bail signé, l'occupation concurrente du lot se relit après le verrou du lot, jamais avant.
     */
    public function handle(Lease $lease, NewLeaseUnitChangeData $donnees): Lease
    {
        return DB::transaction(function () use ($lease, $donnees): Lease {
            $bail = $this->baux->locked($lease->id);

            $this->assertEditable($bail, $donnees->lockVersion);

            $ligne = $this->place($bail, $donnees->unitId, $donnees->isMain, $donnees->validFrom);

            $bail->lock_version = $bail->lock_version + 1;
            $bail->save();

            $this->audit->handle('leases.unit.added', subject: $bail, metadata: [
                'lease_unit_id' => $ligne->id,
                'unit_id' => $ligne->unit_id,
                'is_main' => $ligne->is_main,
                'valid_from' => $donnees->validFrom,
            ]);

            return $bail;
        });
    }

    /**
     * À appeler dans la transaction qui tient le verrou de ligne du bail.
     */
    public function assertEditable(Lease $bail, int $lockVersion): void
    {
        if ($bail->archived_at !== null) {
            throw ErrorCode::LeaseArchived->problem();
        }

        if (! in_array($bail->status, [LeaseStatus::Draft, LeaseStatus::Signed], true)) {
            throw ErrorCode::LeaseAlreadyTerminated->problem();
        }

        if ($bail->lock_version !== $lockVersion) {
            throw ErrorCode::LeaseStaleVersion->problem();
        }
    }

    /**
     * Écrit la ligne de lot ; le bail est déjà verrouillé par l'appelant, dans sa transaction. Le verrou du lot se prend
     * avant toute lecture non verrouillante : sous REPEATABLE READ la première en fige l'instantané.
     */
    public function place(Lease $bail, string $unitId, bool $isMain, string $validFrom): LeaseUnit
    {
        $fin = $bail->effectiveEnd();

        if ($validFrom < $bail->starts_on->toDateString() || ($fin !== null && $validFrom >= $fin)) {
            throw ErrorCode::LeasePeriodInvalid->problem('Le lot doit entrer dans le bail pendant sa durée : à partir de son début et avant sa fin.');
        }

        if ($bail->status === LeaseStatus::Signed) {
            $this->verrou->acquire([$unitId]);
        }

        $lot = $this->lots->find($unitId);

        if ($lot->isArchived || $lot->address['country'] !== $bail->jurisdiction) {
            throw ErrorCode::LeaseUnitNotAvailable->problem();
        }

        $lignes = LeaseUnit::query()->where('lease_id', $bail->id)->get();

        foreach ($lignes as $ligne) {
            if ($ligne->unit_id === $unitId && $this->occupations->overlap($validFrom, null, $ligne->valid_from->toDateString(), $ligne->valid_to?->toDateString())) {
                throw ErrorCode::LeaseUnitConflict->problem();
            }
        }

        if ($isMain) {
            foreach ($lignes as $ligne) {
                if ($ligne->is_main && $this->occupations->overlap($validFrom, null, $ligne->valid_from->toDateString(), $ligne->valid_to?->toDateString())) {
                    throw ErrorCode::LeaseMainUnitConflict->problem();
                }
            }
        }

        if ($bail->status === LeaseStatus::Signed) {
            $this->assertFree($bail, $unitId, $validFrom);
        }

        return LeaseUnit::query()->create([
            'lease_id' => $bail->id,
            'unit_id' => $unitId,
            'is_main' => $isMain,
            'valid_from' => $validFrom,
        ]);
    }

    private function assertFree(Lease $bail, string $unitId, string $validFrom): void
    {
        $periode = $this->occupations->period($validFrom, null, $bail);

        if ($periode === null) {
            return;
        }

        foreach ($this->occupations->of([$unitId], $bail->id) as $autre) {
            if ($this->occupations->overlap($periode['from'], $periode['to'], $autre['from'], $autre['to'])) {
                throw ErrorCode::LeaseOverlap->problem();
            }
        }
    }
}
