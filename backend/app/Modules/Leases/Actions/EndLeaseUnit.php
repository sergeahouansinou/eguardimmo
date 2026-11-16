<?php

declare(strict_types=1);

namespace App\Modules\Leases\Actions;

use App\Modules\Leases\Data\EndLeaseUnitData;
use App\Modules\Leases\Enums\ErrorCode;
use App\Modules\Leases\Models\Lease;
use App\Modules\Leases\Models\LeaseUnit;
use App\Modules\Leases\Queries\Leases;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

final readonly class EndLeaseUnit
{
    public function __construct(
        private Leases $baux,
        private AddLeaseUnit $ajout,
        private RecordAudit $audit,
    ) {}

    /**
     * Le lot principal ne se ferme qu'en désignant, dans la même demande, le lot qui le remplace à la date de fermeture.
     */
    public function handle(Lease $lease, string $leaseUnitId, EndLeaseUnitData $donnees): Lease
    {
        return DB::transaction(function () use ($lease, $leaseUnitId, $donnees): Lease {
            $bail = $this->baux->locked($lease->id);

            $this->ajout->assertEditable($bail, $donnees->lockVersion);

            $ligne = (Str::isUuid($leaseUnitId) ? LeaseUnit::query()->where('lease_id', $bail->id)->whereKey($leaseUnitId)->lockForUpdate()->first() : null)
                ?? throw ErrorCode::LeaseUnitNotFound->problem();

            $this->assertClosable($bail, $ligne, $donnees);

            $ligne->setAttribute('valid_to', $donnees->validTo);
            $ligne->save();

            if ($donnees->replaceWithUnitId !== null) {
                $this->ajout->place($bail, $donnees->replaceWithUnitId, true, $donnees->validTo);
            }

            $bail->lock_version = $bail->lock_version + 1;
            $bail->save();

            $this->audit->handle('leases.unit.ended', subject: $bail, metadata: [
                'lease_unit_id' => $ligne->id,
                'unit_id' => $ligne->unit_id,
                'valid_to' => $donnees->validTo,
                'replaced_by_unit_id' => $donnees->replaceWithUnitId,
            ]);

            return $bail;
        });
    }

    private function assertClosable(Lease $bail, LeaseUnit $ligne, EndLeaseUnitData $donnees): void
    {
        if ($ligne->valid_to !== null) {
            throw ErrorCode::LeasePeriodInvalid->problem('Ce lot est déjà fermé dans le bail.');
        }

        $fin = $bail->effectiveEnd();

        if ($donnees->validTo <= $ligne->valid_from->toDateString() || ($fin !== null && $donnees->validTo > $fin)) {
            throw ErrorCode::LeasePeriodInvalid->problem('La fermeture doit suivre le début du lot et ne pas dépasser la fin du bail.');
        }

        if (! $ligne->is_main) {
            if ($donnees->replaceWithUnitId !== null) {
                throw ValidationException::withMessages(['replace_with_unit_id' => ['Seul le lot principal se remplace.']]);
            }

            return;
        }

        if ($donnees->replaceWithUnitId === null) {
            throw ErrorCode::LeaseNoMainUnit->problem('Le lot principal ne se ferme qu\'en désignant le lot qui le remplace à cette date.');
        }
    }
}
