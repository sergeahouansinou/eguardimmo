<?php

declare(strict_types=1);

namespace App\Modules\Properties\Actions;

use App\Modules\Properties\Enums\ErrorCode;
use App\Modules\Properties\Models\Unit;
use App\Modules\Properties\Models\UnitOwnership;
use App\Modules\Properties\Queries\Ownerships;
use App\Modules\Properties\Queries\Units;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

final readonly class EndOwnership
{
    public function __construct(
        private Units $units,
        private Ownerships $ownerships,
    ) {}

    /**
     * La date de fin est exclue de la période : le droit s'éteint à cette date.
     */
    public function handle(Unit $unit, UnitOwnership $ownership, string $validTo): UnitOwnership
    {
        return DB::transaction(function () use ($unit, $ownership, $validTo): UnitOwnership {
            $lot = $this->units->locked($unit->id);
            $ligne = $this->ownerships->get($lot->id, $ownership->id);

            if ($ligne->valid_to !== null) {
                throw ErrorCode::OwnershipClosed->problem();
            }

            if ($validTo <= $ligne->valid_from->toDateString()) {
                throw ErrorCode::OwnershipPeriodInvalid->problem();
            }

            $ligne->valid_to = Carbon::createFromFormat('Y-m-d', $validTo)?->startOfDay();
            $ligne->save();

            return $ligne;
        });
    }
}
