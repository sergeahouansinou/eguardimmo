<?php

declare(strict_types=1);

namespace App\Modules\Properties\Actions;

use App\Modules\Properties\Enums\ErrorCode;
use App\Modules\Properties\Models\Unit;
use App\Modules\Properties\Queries\Properties;
use App\Modules\Properties\Queries\Units;
use Illuminate\Support\Facades\DB;

final readonly class ArchiveUnit
{
    public function __construct(
        private Properties $properties,
        private Units $units,
    ) {}

    public function handle(Unit $unit): Unit
    {
        return DB::transaction(function () use ($unit): Unit {
            $this->properties->locked($unit->property_id);
            $lot = $this->units->locked($unit->id);

            if ($lot->archived_at !== null) {
                return $lot;
            }

            if (Unit::query()->where('parent_unit_id', $lot->id)->whereNull('archived_at')->exists()) {
                throw ErrorCode::UnitHasActiveAnnexes->problem();
            }

            $lot->archived_at = now();
            $lot->save();

            return $lot;
        });
    }
}
