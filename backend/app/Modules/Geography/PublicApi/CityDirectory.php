<?php

declare(strict_types=1);

namespace App\Modules\Geography\PublicApi;

use App\Modules\Geography\Data\CityData;
use App\Modules\Geography\Queries\Places;

/**
 * Lecture des communes pour les autres modules ; le référentiel est commun, sans contexte d'organisation.
 */
final readonly class CityDirectory
{
    public function __construct(private Places $lieux) {}

    public function find(string $id): ?CityData
    {
        return $this->lieux->many([$id])[$id] ?? null;
    }

    public function findBySlug(string $slug): ?CityData
    {
        return $this->lieux->bySlug($slug);
    }

    /**
     * @param  list<string>  $ids
     * @return array<string, CityData> par identifiant ; les identifiants inconnus sont absents
     */
    public function findMany(array $ids): array
    {
        return $this->lieux->many($ids);
    }
}
