<?php

declare(strict_types=1);

namespace App\Modules\Properties\PublicApi;

use App\Modules\Properties\Data\PropertyRefData;
use App\Modules\Properties\Data\UnitData;
use App\Modules\Properties\Queries\Properties;
use App\Modules\Properties\Queries\UnitSummaries;

/**
 * Lecture des lots pour les autres modules ; suppose un contexte d'organisation.
 * Aucune occupation ici : « loué » ou « vacant » se déduit des baux (module Leases), jamais du patrimoine.
 */
final readonly class UnitDirectory
{
    public function __construct(
        private UnitSummaries $resumes,
        private Properties $sites,
    ) {}

    /**
     * Lève unit_not_found hors de l'organisation courante.
     */
    public function find(string $id): UnitData
    {
        return $this->resumes->one($id);
    }

    /**
     * Lève property_not_found hors de l'organisation courante.
     */
    public function findProperty(string $id): PropertyRefData
    {
        $site = $this->sites->get($id);

        return new PropertyRefData($site->id, $site->name, $site->archived_at !== null);
    }

    /**
     * Lève unit_not_found si un identifiant est inconnu ou hors de l'organisation courante.
     *
     * @param  list<string>  $ids
     * @return array<string, UnitData> par identifiant
     */
    public function findMany(array $ids): array
    {
        return $this->resumes->many($ids);
    }

    /**
     * Lève property_not_found hors de l'organisation courante.
     *
     * @return list<UnitData>
     */
    public function ofProperty(string $propertyId): array
    {
        return $this->resumes->ofProperty($propertyId);
    }
}
