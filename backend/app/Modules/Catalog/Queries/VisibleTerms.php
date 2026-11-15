<?php

declare(strict_types=1);

namespace App\Modules\Catalog\Queries;

use App\Modules\Catalog\Data\TermData;
use App\Modules\Catalog\Enums\VocabularyKey;
use App\Modules\Catalog\Models\Term;
use App\Modules\Catalog\Models\TermOverride;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Str;

final readonly class VisibleTerms
{
    public function __construct(private CurrentOrganization $organisation) {}

    /**
     * Valeurs de la plateforme et de l'organisation courante : Term n'a pas de scope global.
     *
     * @return Builder<Term>
     */
    public function query(): Builder
    {
        return Term::query()->where(function (Builder $requete): void {
            $requete->whereNull('organization_id')->orWhere('organization_id', $this->organisation->id());
        });
    }

    public function find(string $id, VocabularyKey $vocabulaire): ?Term
    {
        if (! Str::isUuid($id)) {
            return null;
        }

        return $this->query()->where('vocabulary', $vocabulaire->value)->find($id);
    }

    public function get(string $id): ?Term
    {
        return Str::isUuid($id) ? $this->query()->find($id) : null;
    }

    /**
     * @return list<TermData>
     */
    public function resolved(VocabularyKey $vocabulaire, bool $includeInactive = false, ?string $semanticKey = null): array
    {
        $requete = $this->query()->where('vocabulary', $vocabulaire->value);

        if ($semanticKey !== null) {
            $requete->where('semantic_key', $semanticKey);
        }

        if (! $includeInactive) {
            $requete->whereNull('archived_at');
        }

        $valeurs = $requete->get();
        $surcharges = $this->overrides($valeurs->modelKeys());

        $donnees = [];

        foreach ($valeurs as $valeur) {
            $donnee = $this->toData($valeur, $surcharges[$valeur->id] ?? null);

            if ($includeInactive || ! $donnee->isHidden) {
                $donnees[] = $donnee;
            }
        }

        usort($donnees, fn (TermData $a, TermData $b): int => [$a->position, $a->key] <=> [$b->position, $b->key]);

        return $donnees;
    }

    public function one(Term $valeur): TermData
    {
        return $this->toData($valeur, $this->overrides([$valeur->id])[$valeur->id] ?? null);
    }

    /**
     * @param  array<int, int|string>  $ids
     * @return array<string, TermOverride>
     */
    private function overrides(array $ids): array
    {
        return TermOverride::query()->whereIn('term_id', $ids)->get()->keyBy('term_id')->all();
    }

    private function toData(Term $valeur, ?TermOverride $surcharge): TermData
    {
        return new TermData(
            id: $valeur->id,
            vocabulary: $valeur->vocabulary,
            key: $valeur->key,
            labels: array_merge($valeur->labels, $surcharge->labels ?? []),
            semanticKey: $valeur->semantic_key,
            parentId: $valeur->parent_id,
            position: $surcharge->position ?? $valeur->position,
            metadata: $valeur->metadata ?? [],
            isPlatform: $valeur->organization_id === null,
            isSystem: $valeur->is_system,
            isArchived: $valeur->archived_at !== null,
            isHidden: $surcharge !== null && $surcharge->hidden,
            isOverridden: $surcharge !== null,
        );
    }
}
