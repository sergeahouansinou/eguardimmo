<?php

declare(strict_types=1);

namespace App\Modules\Recovery\Support;

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
            'statement', 'lease', 'ledger' => View::make('recovery::'.$vue, ['s' => $snapshot])->render(),
            default => throw new InvalidArgumentException("Vue inconnue : {$vue}."),
        };
    }
}
