<?php

declare(strict_types=1);

namespace App\Modules\Documents\Support;

use App\Modules\Documents\Data\DocumentSubject;
use App\Modules\Documents\Enums\ErrorCode;
use App\Modules\Documents\Enums\SubjectType;
use App\Shared\Tenancy\BelongsToOrganization;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Support\Str;

/**
 * Vérifie qu'un objet désigné par le client existe dans l'organisation courante, sans importer le modèle de son module :
 * seule la morph map le relie.
 */
final readonly class SubjectGuard
{
    public function __construct(private CurrentOrganization $organisation) {}

    public function ensure(DocumentSubject $sujet): void
    {
        $classe = SubjectType::tryFrom($sujet->type) === null ? null : Relation::getMorphedModel($sujet->type);

        if ($classe === null || ! Str::isUuid($sujet->id) || ! is_subclass_of($classe, Model::class)) {
            throw ErrorCode::SubjectNotFound->problem();
        }

        if ($sujet->type === SubjectType::Organization->value) {
            if ($sujet->id !== $this->organisation->id()) {
                throw ErrorCode::SubjectNotFound->problem();
            }

            return;
        }

        $cloisonne = in_array(BelongsToOrganization::class, class_uses_recursive($classe), true);

        if (! $cloisonne || ! $classe::query()->whereKey($sujet->id)->exists()) {
            throw ErrorCode::SubjectNotFound->problem();
        }
    }
}
