<?php

declare(strict_types=1);

namespace App\Modules\Tax\Support;

use Illuminate\Support\Facades\View;

final class SummaryHtml
{
    /**
     * Le HTML ne lit que l'instantané : même synthèse, même pièce. Le nom du contribuable est le seul identifiant (aucune coordonnée).
     *
     * @param  array<string, mixed>  $instantane
     */
    public function render(array $instantane, string $reference, ?string $titulaire, bool $provisoire = false): string
    {
        $unite = SummaryText::minorPerMajor((string) $instantane['currency']);
        $avertissements = [];
        foreach (is_array($instantane['warnings'] ?? null) ? $instantane['warnings'] : [] as $avertissement) {
            if (is_array($avertissement)) {
                $avertissements[] = $avertissement;
            }
        }

        return View::make('tax::summary', [
            's' => $instantane,
            'reference' => $reference,
            'titulaire' => $titulaire,
            'provisoire' => $provisoire,
            'euros' => fn (int $minor): string => SummaryText::euros($minor, $unite),
            'messages' => SummaryText::messages($avertissements, $unite),
        ])->render();
    }
}
