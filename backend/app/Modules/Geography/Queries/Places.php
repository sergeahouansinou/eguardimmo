<?php

declare(strict_types=1);

namespace App\Modules\Geography\Queries;

use App\Modules\Geography\Data\CityData;
use App\Modules\Geography\Models\City;
use Illuminate\Database\Eloquent\Builder;

final class Places
{
    public const int LIMITE = 10;

    /**
     * Correspondance par préfixe sur le nom ou le code postal ; les jokers de LIKE saisis par le client sont neutralisés.
     *
     * @return list<CityData>
     */
    public function search(string $terme): array
    {
        $prefixe = str_replace(['!', '%', '_'], ['!!', '!%', '!_'], trim($terme)).'%';

        $villes = City::query()
            ->with('country')
            ->where(fn (Builder $q) => $q->whereRaw("name like ? escape '!'", [$prefixe])->orWhereRaw("postal_code like ? escape '!'", [$prefixe]))
            ->orderBy('name')
            ->orderBy('postal_code')
            ->limit(self::LIMITE)
            ->get()
            ->map(self::data(...));

        return array_values($villes->all());
    }

    public function bySlug(string $slug): ?CityData
    {
        $ville = City::query()->with('country')->where('slug', $slug)->first();

        return $ville === null ? null : self::data($ville);
    }

    /**
     * @param  list<string>  $ids
     * @return array<string, CityData> par identifiant
     */
    public function many(array $ids): array
    {
        $resultat = [];

        foreach (City::query()->with('country')->whereIn('id', $ids)->get() as $ville) {
            $resultat[$ville->id] = self::data($ville);
        }

        return $resultat;
    }

    private static function data(City $ville): CityData
    {
        return new CityData($ville->id, $ville->slug, $ville->name, $ville->postal_code, (string) $ville->country?->code);
    }
}
