<?php

declare(strict_types=1);

namespace App\Shared\Http;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Entrée commune des listes de l'espace propriétaire (ADR 0032) : pagination par curseur et `?agency=`, qui restreint seulement
 * le périmètre déjà rattaché au compte. Le client n'envoie jamais d'organisation ni de mandant.
 *
 * @phpstan-require-extends FormRequest
 */
trait ListsForOwner
{
    use PaginatesWithCursor;

    /**
     * @param  array<string, string>  $colonnesDuCurseur
     * @param  array<string, list<mixed>>  $autres
     * @return array<string, list<mixed>>
     */
    public function ownerRules(array $colonnesDuCurseur, array $autres = []): array
    {
        return [...$this->paginationRules($colonnesDuCurseur), 'agency' => ['nullable', 'string', 'max:64'], ...$autres];
    }

    public function agency(): ?string
    {
        return $this->filled('agency') ? (string) $this->validated('agency') : null;
    }

    public function cursor(): ?string
    {
        return $this->filled('cursor') ? (string) $this->validated('cursor') : null;
    }
}
