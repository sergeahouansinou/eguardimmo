<?php

declare(strict_types=1);

namespace App\Modules\Geography\Actions;

use App\Modules\Geography\Models\City;
use App\Modules\Geography\Models\Country;
use App\Modules\Geography\Support\FrenchCities;
use Illuminate\Support\Facades\DB;

final class SeedCatalog
{
    public function handle(): void
    {
        DB::transaction(function (): void {
            $france = Country::query()->updateOrCreate(['code' => 'FR'], ['name' => 'France']);

            foreach (FrenchCities::all() as [$nom, $codePostal, $latitude, $longitude]) {
                City::query()->updateOrCreate(
                    ['country_id' => $france->id, 'slug' => str($nom)->slug()->toString()],
                    ['name' => $nom, 'postal_code' => $codePostal, 'latitude' => $latitude, 'longitude' => $longitude],
                );
            }
        });
    }
}
