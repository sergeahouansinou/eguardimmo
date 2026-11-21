<?php

declare(strict_types=1);

namespace App\Modules\Tax\Support;

/**
 * Clé de la synthèse vivante : une seule par organisation, portée, mandant et année (index unique). Un rectificatif de mandant en
 * attente de publication a sa propre clé, par original, pour que l'original publié reste lisible jusque-là.
 */
final class ActiveKeys
{
    public static function organization(int $annee): string
    {
        return "org|{$annee}";
    }

    public static function mandant(string $mandantPartyId, int $annee): string
    {
        return "mandant|{$mandantPartyId}|{$annee}";
    }

    public static function pendingRectification(string $originalId): string
    {
        return "rect|{$originalId}";
    }
}
