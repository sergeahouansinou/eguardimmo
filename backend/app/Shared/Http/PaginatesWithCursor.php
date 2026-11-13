<?php

declare(strict_types=1);

namespace App\Shared\Http;

use Illuminate\Foundation\Http\FormRequest;

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
     * @return array<string, list<string>>
     */
    public function paginationRules(): array
    {
        return [
            'per_page' => ['nullable', 'integer', 'min:1', 'max:'.self::PAR_PAGE_MAX],
            'cursor' => ['nullable', 'string', 'max:1024'],
        ];
    }

    public function perPage(): int
    {
        return $this->integer('per_page', self::PAR_PAGE_DEFAUT);
    }
}
