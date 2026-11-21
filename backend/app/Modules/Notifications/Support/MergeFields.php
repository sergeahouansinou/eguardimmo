<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Support;

use App\Modules\Notifications\Enums\CampaignAudience;
use App\Shared\Mail\MailText;

/**
 * Champs de fusion en liste fermée (ADR 0033, décision 10) : `{{ Prénom }}` ou `{ Prénom }`. Les valeurs sont remplies par le serveur,
 * jamais fournies par le client ; elles s'insèrent comme texte brut, sans caractère de contrôle. « Loyer » n'existe plus.
 */
final class MergeFields
{
    public const string TENANT_FIRST_NAME = 'Prénom';

    private const string TAG = '/\{\{\s*([^{}]+?)\s*\}\}|\{\s*([^{}]+?)\s*\}/u';

    /**
     * @return list<string>
     */
    public static function allowedFor(CampaignAudience $audience): array
    {
        return match ($audience) {
            CampaignAudience::Tenants => ['Prénom', 'Bien', 'Mois', 'Échéance'],
            CampaignAudience::Mandants => ['Prénom', 'Mandat', 'Mois'],
        };
    }

    /**
     * @return list<string> champs inconnus ou hors de l'audience, sans doublon
     */
    public static function unknownIn(string $texte, CampaignAudience $audience): array
    {
        preg_match_all(self::TAG, $texte, $trouves, PREG_SET_ORDER);
        $inconnus = [];

        foreach ($trouves as $trouve) {
            $nom = self::name($trouve);

            if (! in_array($nom, self::allowedFor($audience), true)) {
                $inconnus[$nom] = $nom;
            }
        }

        return array_values($inconnus);
    }

    /**
     * @param  array<int, string>  $trouve
     */
    private static function name(array $trouve): string
    {
        return trim(($trouve[1] ?? '') !== '' ? $trouve[1] : ($trouve[2] ?? ''));
    }

    /**
     * @param  array<string, string>  $valeurs
     */
    public static function render(string $texte, array $valeurs): string
    {
        return (string) preg_replace_callback(self::TAG, function (array $trouve) use ($valeurs): string {
            $nom = self::name($trouve);

            return isset($valeurs[$nom]) ? MailText::plain($valeurs[$nom]) : '';
        }, $texte);
    }
}
