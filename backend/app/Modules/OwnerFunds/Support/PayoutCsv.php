<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Support;

use App\Modules\OwnerFunds\Enums\PayoutItemStatus;
use App\Modules\OwnerFunds\Models\PayoutBatch;
use App\Modules\Parties\PublicApi\PartyDirectory;
use App\Shared\Csv\CsvField;

/**
 * Export des virements à exécuter : jamais l'IBAN complet, seulement ses quatre derniers caractères.
 */
final readonly class PayoutCsv
{
    public function __construct(private PartyDirectory $parties) {}

    public function render(PayoutBatch $lot): string
    {
        $lignes = $lot->items->filter(fn ($e): bool => in_array($e->status, [PayoutItemStatus::Pending, PayoutItemStatus::Paid, PayoutItemStatus::Returned], true))->values();
        $noms = [];

        foreach ($this->parties->findMany(array_values($lignes->pluck('mandant_party_id')->all())) as $partie) {
            $noms[$partie->id] = $partie->displayName;
        }

        $sortie = [self::ligne(['reference', 'mandant', 'libelle', 'montant_minor', 'devise', 'compte_derniers_caracteres', 'statut'])];

        foreach ($lignes as $e) {
            $sortie[] = self::ligne([
                (string) $lot->number,
                $noms[$e->mandant_party_id] ?? '',
                'Reversement '.$lot->number,
                (int) $e->net_amount->getAmount(),
                $lot->currency,
                (string) $e->bank_last4,
                $e->status->value,
            ]);
        }

        return "\u{FEFF}".implode("\r\n", $sortie)."\r\n";
    }

    /**
     * @param  list<string|int>  $champs
     */
    private static function ligne(array $champs): string
    {
        return implode(';', array_map(CsvField::render(...), $champs));
    }
}
