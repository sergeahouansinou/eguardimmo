<?php

declare(strict_types=1);

namespace App\Modules\Tax\Support;

use InvalidArgumentException;
use Money\Currencies\ISOCurrencies;
use Money\Currency;

/**
 * Libellés français des avertissements et des montants : un code se traduit ici, jamais dans une vue ou une réponse.
 */
final class SummaryText
{
    /**
     * @param  list<array<string, mixed>>  $avertissements
     * @return list<string>
     */
    public static function messages(array $avertissements, int $minorPerMajor): array
    {
        $sortie = [];

        foreach ($avertissements as $a) {
            $montant = isset($a['amount']) && is_int($a['amount']) ? self::euros($a['amount'], $minorPerMajor) : '';
            $texte = match ($a['code'] ?? null) {
                'unresolved_collection' => "Un encaissement de {$montant} n'a pas pu être ventilé entre loyer et charges : il n'est pas compté en ligne 211.",
                'excluded_regime' => "Des loyers encaissés ({$montant}) relèvent d'un bail hors location nue (meublé, mobilité) : ils ne figurent pas sur ce relevé.",
                'unclassified_expense' => "Une dépense de {$montant} n'a pas de ligne du formulaire (catégorie « autre » ou « charges courantes ») : elle n'est pas comptée.",
                'unattributed_fee' => "Des honoraires de {$montant} ne se rattachent à aucun bien : ils ne sont pas comptés en ligne 221.",
                'shared_ownership' => 'Ce bien a plusieurs propriétaires : les montants sont à 100 % du bien, à répartir selon vos droits.',
                'negative_line' => 'Une ligne est négative (remboursement ou annulation) : vérifiez-la.',
                'sources_truncated' => 'La liste des sources d\'une ligne est tronquée ; le montant, lui, est complet.',
                default => null,
            };

            $texte === null || $sortie[] = $texte;
        }

        return array_values(array_unique($sortie));
    }

    public static function minorPerMajor(string $devise): int
    {
        if ($devise === '') {
            throw new InvalidArgumentException('Devise absente de l\'instantané.');
        }

        return 10 ** (new ISOCurrencies)->subunitFor(new Currency($devise));
    }

    public static function euros(int $minor, int $minorPerMajor): string
    {
        $entier = Rounding::toMajor($minor, $minorPerMajor);

        return ($entier < 0 ? '-' : '').number_format(abs(intdiv($entier, $minorPerMajor)), 0, ',', "\u{202F}")."\u{00A0}€";
    }
}
