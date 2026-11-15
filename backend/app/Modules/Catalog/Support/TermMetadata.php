<?php

declare(strict_types=1);

namespace App\Modules\Catalog\Support;

use App\Modules\Catalog\Enums\VocabularyKey;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

final class TermMetadata
{
    /**
     * @param  array<string, mixed>  $metadata
     * @return array<string, mixed>
     *
     * @throws ValidationException
     */
    public static function validated(VocabularyKey $vocabulaire, array $metadata): array
    {
        $regles = $vocabulaire->metadataRules();
        $inconnues = array_diff(array_keys($metadata), array_keys($regles));

        $regles = array_combine(
            array_map(fn (string $cle): string => "metadata.{$cle}", array_keys($regles)),
            array_values($regles),
        );

        $validateur = Validator::make(['metadata' => $metadata], $regles);
        $validateur->after(function ($validateur) use ($inconnues): void {
            foreach ($inconnues as $cle) {
                $validateur->errors()->add("metadata.{$cle}", 'Cette propriété n\'existe pas pour ce référentiel.');
            }
        });

        $valide = $validateur->validate();

        return is_array($valide['metadata'] ?? null) ? $valide['metadata'] : [];
    }
}
