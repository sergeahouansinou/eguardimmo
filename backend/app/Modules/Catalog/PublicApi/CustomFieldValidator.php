<?php

declare(strict_types=1);

namespace App\Modules\Catalog\PublicApi;

use App\Modules\Catalog\Actions\RecordCustomFieldUsage;
use App\Modules\Catalog\Actions\ValidateCustomFields;
use App\Modules\Catalog\Enums\CustomFieldEntity;
use Illuminate\Validation\ValidationException;

/**
 * Validation de la colonne `custom_fields` des modules extensibles contre les définitions actives de l'organisation courante.
 * Le module appelant appelle validate() avant d'écrire, puis recordUsage() dans la même transaction.
 */
final readonly class CustomFieldValidator
{
    public function __construct(
        private ValidateCustomFields $validation,
        private RecordCustomFieldUsage $usage,
    ) {}

    /**
     * Remplace les valeurs des champs actifs par `$input` ; conserve de `$current` celles des champs archivés ou sans définition.
     * Un champ absent, nul ou vide est retiré ; un champ obligatoire absent est refusé.
     *
     * @param  array<string, mixed>  $input
     * @param  array<string, mixed>  $current
     * @return array<string, mixed>
     *
     * @throws ValidationException
     */
    public function validate(CustomFieldEntity $entity, array $input, array $current = []): array
    {
        return $this->validation->handle($entity, $input, $current);
    }

    /**
     * Fige le type des champs dont une valeur vient d'être écrite.
     *
     * @param  array<string, mixed>  $values  valeurs retournées par validate()
     */
    public function recordUsage(CustomFieldEntity $entity, array $values): void
    {
        $this->usage->handle($entity, $values);
    }
}
