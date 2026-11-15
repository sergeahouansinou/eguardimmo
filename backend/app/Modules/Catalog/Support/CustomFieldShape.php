<?php

declare(strict_types=1);

namespace App\Modules\Catalog\Support;

use App\Modules\Catalog\Enums\CustomFieldType;
use Illuminate\Validation\ValidationException;

final class CustomFieldShape
{
    /**
     * Un champ choix porte des options, un champ référentiel un référentiel, aucun autre ni l'un ni l'autre.
     *
     * @param  list<array{key: string, labels: array<string, string>}>|null  $options
     *
     * @throws ValidationException
     */
    public static function assert(CustomFieldType $type, ?string $vocabulaire, ?array $options): void
    {
        $erreurs = [];

        if (in_array($type, [CustomFieldType::Select, CustomFieldType::Multiselect], true)) {
            if ($options === null || $options === []) {
                $erreurs['options'] = ['Un champ à choix demande au moins une option.'];
            }
        } elseif ($options !== null) {
            $erreurs['options'] = ['Seuls les champs à choix portent des options.'];
        }

        if ($type === CustomFieldType::Term) {
            if ($vocabulaire === null) {
                $erreurs['vocabulary'] = ['Un champ référentiel demande son référentiel.'];
            }
        } elseif ($vocabulaire !== null) {
            $erreurs['vocabulary'] = ['Seuls les champs référentiel portent un référentiel.'];
        }

        if ($erreurs !== []) {
            throw ValidationException::withMessages($erreurs);
        }
    }
}
