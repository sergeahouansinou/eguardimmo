<?php

declare(strict_types=1);

namespace App\Modules\Catalog\Actions;

use App\Modules\Catalog\Enums\CustomFieldEntity;
use App\Modules\Catalog\Models\CustomFieldDefinition;
use App\Modules\Catalog\Support\CustomFieldValue;
use Illuminate\Validation\ValidationException;
use InvalidArgumentException;

final readonly class ValidateCustomFields
{
    public function __construct(private CustomFieldValue $valeurs) {}

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
    public function handle(CustomFieldEntity $entity, array $input, array $current = []): array
    {
        $actifs = CustomFieldDefinition::query()
            ->where('entity', $entity->value)
            ->whereNull('archived_at')
            ->orderBy('position')
            ->get()
            ->keyBy('key');

        $erreurs = [];
        $retenues = [];

        foreach (array_diff(array_keys($input), $actifs->keys()->all()) as $cle) {
            $erreurs["custom_fields.{$cle}"] = ['Ce champ personnalisé n\'existe pas ou est archivé.'];
        }

        foreach ($actifs as $cle => $champ) {
            $valeur = $input[$cle] ?? null;

            if ($valeur === null || $valeur === '' || $valeur === []) {
                if ($champ->required) {
                    $erreurs["custom_fields.{$cle}"] = ['Ce champ est obligatoire.'];
                }

                continue;
            }

            try {
                $retenues[$cle] = $this->valeurs->normalize($champ, $valeur, array_key_exists($cle, $current) && $current[$cle] === $valeur);
            } catch (InvalidArgumentException $refus) {
                $erreurs["custom_fields.{$cle}"] = [$refus->getMessage()];
            }
        }

        if ($erreurs !== []) {
            throw ValidationException::withMessages($erreurs);
        }

        return array_merge(array_diff_key($current, $actifs->all()), $retenues);
    }
}
