<?php

declare(strict_types=1);

namespace App\Modules\Properties\Actions;

use App\Modules\Parties\PublicApi\PartyDirectory;
use App\Modules\Properties\Data\NewOwnershipData;
use App\Modules\Properties\Enums\ErrorCode;
use App\Modules\Properties\Models\Unit;
use App\Modules\Properties\Models\UnitOwnership;
use App\Modules\Properties\Queries\Ownerships;
use App\Modules\Properties\Queries\Units;
use App\Modules\Properties\Support\OwnershipLoad;
use Illuminate\Support\Facades\DB;

final readonly class AddOwnership
{
    public function __construct(
        private Units $units,
        private Ownerships $ownerships,
        private PartyDirectory $parties,
    ) {}

    /**
     * Le verrou du lot sérialise les écritures de propriété : la somme est lue après l'avoir pris, jamais avant.
     */
    public function handle(Unit $unit, NewOwnershipData $donnees): UnitOwnership
    {
        if ($donnees->validTo !== null && $donnees->validTo <= $donnees->validFrom) {
            throw ErrorCode::OwnershipPeriodInvalid->problem();
        }

        return DB::transaction(function () use ($unit, $donnees): UnitOwnership {
            $lot = $this->units->locked($unit->id);

            if ($this->parties->find($donnees->partyId)->isAnonymized) {
                throw ErrorCode::OwnerAnonymized->problem();
            }

            $existantes = $this->ownerships->overlapping($lot->id, $donnees->nature, $donnees->validFrom, $donnees->validTo);

            foreach ($existantes as $ligne) {
                if ($ligne->party_id === $donnees->partyId) {
                    throw ErrorCode::OwnershipOverlap->problem();
                }
            }

            $lignes = array_map(fn (UnitOwnership $ligne): array => [
                'from' => $ligne->valid_from->toDateString(),
                'to' => $ligne->valid_to?->toDateString(),
                'share' => $ligne->share_bp,
            ], $existantes);
            $lignes[] = ['from' => $donnees->validFrom, 'to' => $donnees->validTo, 'share' => $donnees->shareBp];

            if (OwnershipLoad::peak($lignes, $donnees->validFrom, $donnees->validTo) > OwnershipLoad::CAP) {
                throw ErrorCode::OwnershipShareExceeded->problem();
            }

            return UnitOwnership::query()->create([
                'unit_id' => $lot->id,
                'party_id' => $donnees->partyId,
                'share_bp' => $donnees->shareBp,
                'nature' => $donnees->nature,
                'valid_from' => $donnees->validFrom,
                'valid_to' => $donnees->validTo,
            ]);
        });
    }
}
