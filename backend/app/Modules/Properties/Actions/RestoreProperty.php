<?php

declare(strict_types=1);

namespace App\Modules\Properties\Actions;

use App\Modules\Properties\Models\Property;
use App\Modules\Properties\Queries\Properties;
use Illuminate\Support\Facades\DB;

final readonly class RestoreProperty
{
    public function __construct(private Properties $properties) {}

    public function handle(Property $property): Property
    {
        return DB::transaction(function () use ($property): Property {
            $site = $this->properties->locked($property->id);

            if ($site->archived_at !== null) {
                $site->archived_at = null;
                $site->save();
            }

            return $site;
        });
    }
}
