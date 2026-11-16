<?php

declare(strict_types=1);

namespace App\Modules\Catalog\PublicApi;

use App\Modules\Catalog\Data\TermData;
use App\Modules\Catalog\Enums\ErrorCode;
use App\Modules\Catalog\Enums\VocabularyKey;
use App\Modules\Catalog\Queries\VisibleTerms;

/**
 * Lecture des référentiels pour les autres modules ; suppose un contexte d'organisation.
 */
final readonly class TermDirectory
{
    public function __construct(private VisibleTerms $valeurs) {}

    /**
     * Résout une valeur déjà référencée, archivée ou masquée comprise.
     * Lève term_not_found hors du référentiel ou si la valeur est d'une autre organisation.
     */
    public function find(string $id, VocabularyKey $vocabulary): TermData
    {
        $valeur = $this->valeurs->find($id, $vocabulary) ?? throw ErrorCode::TermNotFound->problem();

        return $this->valeurs->one($valeur);
    }

    /**
     * Comme find(), pour plusieurs valeurs en deux requêtes. Lève term_not_found si l'une est hors du référentiel
     * ou d'une autre organisation.
     *
     * @param  list<string>  $ids
     * @return array<string, TermData> par identifiant
     */
    public function findMany(array $ids, VocabularyKey $vocabulary): array
    {
        $ids = array_values(array_unique($ids));

        if ($ids === []) {
            return [];
        }

        $trouvees = $this->valeurs->findMany($ids, $vocabulary);

        foreach ($ids as $id) {
            if (! isset($trouvees[$id])) {
                throw ErrorCode::TermNotFound->problem();
            }
        }

        return $this->valeurs->many(array_values($trouvees));
    }

    /**
     * Comme find(), pour une nouvelle affectation : une valeur archivée ou masquée est refusée.
     */
    public function findAssignable(string $id, VocabularyKey $vocabulary): TermData
    {
        $donnee = $this->find($id, $vocabulary);

        if ($donnee->isArchived || $donnee->isHidden) {
            throw ErrorCode::TermNotFound->problem();
        }

        return $donnee;
    }

    /**
     * Valeurs actives qui portent ce sens système (plusieurs si l'organisation a ajouté les siennes).
     *
     * @return list<TermData>
     */
    public function bySemanticKey(VocabularyKey $vocabulary, string $semanticKey): array
    {
        return $this->valeurs->resolved($vocabulary, semanticKey: $semanticKey);
    }

    /**
     * Valeurs actives et visibles, surcharges appliquées, par position.
     *
     * @return list<TermData>
     */
    public function list(VocabularyKey $vocabulary): array
    {
        return $this->valeurs->resolved($vocabulary);
    }
}
