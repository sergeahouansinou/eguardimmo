<?php

declare(strict_types=1);

namespace App\Modules\Catalog\Support;

use Closure;

final class LabelRules
{
    private const LONGUEUR_MAX = 120;

    /**
     * Libellés par langue (code ISO 639-1). Présence `required` ou `sometimes` : le français est obligatoire ;
     * `nullable` : libellés partiels, utilisés pour surcharger un libellé existant.
     *
     * @param  'required'|'sometimes'|'nullable'  $presence
     * @return array<string, list<mixed>>
     */
    public static function for(string $champ, string $presence = 'required'): array
    {
        $cles = function (string $attribut, mixed $valeur, Closure $echec): void {
            foreach (is_array($valeur) ? array_keys($valeur) : [] as $langue) {
                if (preg_match('/^[a-z]{2}$/D', (string) $langue) !== 1) {
                    $echec('Les libellés se saisissent par code de langue à deux lettres.');

                    return;
                }
            }
        };

        $regles = [
            $champ => [$presence, 'array', 'max:10', $cles],
            "{$champ}.*" => ['string', 'min:1', 'max:'.self::LONGUEUR_MAX],
        ];

        if ($presence !== 'nullable') {
            $regles["{$champ}.fr"] = [$presence === 'required' ? 'required' : "required_with:{$champ}", 'string', 'min:1', 'max:'.self::LONGUEUR_MAX];
        }

        return $regles;
    }
}
