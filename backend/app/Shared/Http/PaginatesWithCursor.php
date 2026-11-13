<?php

declare(strict_types=1);

namespace App\Shared\Http;

use Closure;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Facades\Validator;

/**
 * Règles et lecture communes des listes paginées par curseur.
 *
 * @phpstan-require-extends FormRequest
 */
trait PaginatesWithCursor
{
    public const PAR_PAGE_DEFAUT = 25;

    public const PAR_PAGE_MAX = 100;

    /**
     * Un curseur est une donnée du client : chaque colonne de tri qu'il porte est validée avant d'atteindre la requête SQL.
     *
     * @param  array<string, string>  $colonnesDuCurseur  colonne de tri => règle de validation (`uuid`, `date`…)
     * @return array<string, list<mixed>>
     */
    public function paginationRules(array $colonnesDuCurseur): array
    {
        return [
            'per_page' => ['nullable', 'integer', 'min:1', 'max:'.self::PAR_PAGE_MAX],
            'cursor' => ['nullable', 'string', 'max:1024', $this->curseurValide($colonnesDuCurseur)],
        ];
    }

    public function perPage(): int
    {
        return $this->integer('per_page', self::PAR_PAGE_DEFAUT);
    }

    /**
     * @param  array<string, string>  $colonnes
     */
    private function curseurValide(array $colonnes): Closure
    {
        return function (string $attribut, mixed $valeur, Closure $echec) use ($colonnes): void {
            $decode = is_string($valeur) ? json_decode((string) base64_decode(strtr($valeur, '-_', '+/'), true), true) : null;

            if (! is_array($decode) || ! is_bool($decode['_pointsToNextItems'] ?? null)) {
                $echec('Curseur invalide.');

                return;
            }

            unset($decode['_pointsToNextItems']);
            $attendues = array_keys($colonnes);
            $regles = array_map(fn (string $regle): array => ['required', 'string', $regle], $colonnes);

            if (array_diff(array_keys($decode), $attendues) !== [] || Validator::make($decode, $regles)->fails()) {
                $echec('Curseur invalide.');
            }
        };
    }
}
