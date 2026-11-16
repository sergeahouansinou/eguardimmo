<?php

declare(strict_types=1);

namespace App\Modules\Properties\Actions;

use App\Modules\Properties\Enums\ErrorCode;
use App\Modules\Properties\Models\Property;
use App\Modules\Properties\Models\Unit;
use App\Modules\Properties\Queries\Properties;
use Illuminate\Support\Facades\DB;

final readonly class ArchiveProperty
{
    public function __construct(private Properties $properties) {}

    public function handle(Property $property): Property
    {
        return DB::transaction(function () use ($property): Property {
            $site = $this->properties->locked($property->id);

            if ($site->archived_at !== null) {
                return $site;
            }

            if (Unit::query()->where('property_id', $site->id)->whereNull('archived_at')->exists()) {
                throw ErrorCode::PropertyHasActiveUnits->problem();
            }

            $site->archived_at = now();
            $site->save();

            return $site;
        });
    }
}
