<?php

declare(strict_types=1);

namespace App\Modules\Parties\PublicApi;

use App\Modules\Catalog\Enums\ContactCategorySemantic;
use App\Modules\Parties\Data\PartyData;
use App\Modules\Parties\Queries\PartySummaries;

/**
 * Lecture des parties pour les autres modules ; suppose un contexte d'organisation.
 */
final readonly class PartyDirectory
{
    public function __construct(private PartySummaries $resumes) {}

    /**
     * Lève party_not_found hors de l'organisation courante.
     */
    public function find(string $id): PartyData
    {
        return $this->resumes->one($id);
    }

    /**
     * Comme find(), pour plusieurs parties en quelques requêtes ; lève party_not_found si l'une est hors de l'organisation courante.
     *
     * @param  list<string>  $ids
     * @return array<string, PartyData> par identifiant
     */
    public function findMany(array $ids): array
    {
        return $this->resumes->many($ids);
    }

    /**
     * Parties actives qui portent une catégorie de contact de ce sens (ex. `bailiff` pour le commissaire de justice).
     *
     * @return list<PartyData>
     */
    public function withCategory(ContactCategorySemantic $sens): array
    {
        return $this->resumes->withCategory($sens);
    }

    /**
     * Lève party_not_found hors de l'organisation courante ; null sans e-mail principal ou si la partie est anonymisée.
     */
    public function primaryEmail(string $id): ?string
    {
        return $this->resumes->one($id)->primaryEmail;
    }
}
