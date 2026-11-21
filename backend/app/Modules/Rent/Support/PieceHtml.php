<?php

declare(strict_types=1);

namespace App\Modules\Rent\Support;

use Illuminate\Support\Facades\View;
use InvalidArgumentException;

final class PieceHtml
{
    /**
     * Le HTML ne lit que l'instantané : même contenu, même pièce.
     *
     * @param  array<string, mixed>  $snapshot
     */
    public function render(string $vue, array $snapshot): string
    {
        return match ($vue) {
            'notice' => View::make('rent::notice', ['s' => $snapshot])->render(),
            'receipt' => View::make('rent::receipt', ['s' => $snapshot])->render(),
            default => throw new InvalidArgumentException("Vue inconnue : {$vue}."),
        };
    }
}
