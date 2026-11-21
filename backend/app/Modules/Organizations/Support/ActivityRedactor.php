<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Support;

use App\Shared\Audit\RecordModelChange;

/**
 * Expurgation des entrées du journal avant qu'elles quittent le module (ADR 0038, décision 4).
 */
final class ActivityRedactor
{
    private const string CLES_SENSIBLES = '/password|passwd|token|secret|iban|bic|email|phone|hash|otp|recovery|signature|passport|identity_card|national_id|birth|siren|siret|vat|address|note|body|title|notes/i';

    private const int METADATA_TEXTE_MAX = 120;

    public static function ip(?string $ip): ?string
    {
        if ($ip === null || filter_var($ip, FILTER_VALIDATE_IP) === false) {
            return null;
        }

        $octets = inet_pton($ip);

        if ($octets === false) {
            return null;
        }

        if (strlen($octets) === 4) {
            return implode('.', array_slice(array_map('ord', str_split($octets)), 0, 3)).'.0/24';
        }

        $groupes = array_map(fn (string $groupe): string => ltrim($groupe, '0') ?: '0', str_split(bin2hex(substr($octets, 0, 6)), 4));

        return implode(':', $groupes).'::/48';
    }

    public static function device(?string $userAgent): ?string
    {
        if ($userAgent === null || trim($userAgent) === '') {
            return null;
        }

        $navigateur = match (true) {
            str_contains($userAgent, 'Edg/'), str_contains($userAgent, 'Edge/') => 'Edge',
            str_contains($userAgent, 'OPR/'), str_contains($userAgent, 'Opera') => 'Opera',
            str_contains($userAgent, 'Firefox/') => 'Firefox',
            str_contains($userAgent, 'Chrome/'), str_contains($userAgent, 'CriOS/') => 'Chrome',
            str_contains($userAgent, 'Safari/') => 'Safari',
            str_contains($userAgent, 'Dart/'), str_contains($userAgent, 'okhttp'), str_contains($userAgent, 'CFNetwork') => 'Application mobile',
            default => 'Navigateur inconnu',
        };

        $systeme = match (true) {
            str_contains($userAgent, 'Windows') => 'Windows',
            str_contains($userAgent, 'iPhone'), str_contains($userAgent, 'iPad'), str_contains($userAgent, 'iOS') => 'iOS',
            str_contains($userAgent, 'Android') => 'Android',
            str_contains($userAgent, 'Mac OS X'), str_contains($userAgent, 'Macintosh') => 'macOS',
            str_contains($userAgent, 'Linux') => 'Linux',
            default => null,
        };

        return $systeme === null ? $navigateur : "{$navigateur} sur {$systeme}";
    }

    /**
     * Différentiel tel qu'écrit, avec en plus un masque sur toute clé qui ressemble à une donnée personnelle ou à un secret.
     *
     * @param  array<string, mixed>|null  $changements
     * @return array<string, array{old: mixed, new: mixed}>|null
     */
    public static function changes(?array $changements): ?array
    {
        if ($changements === null) {
            return null;
        }

        $propres = [];

        foreach ($changements as $attribut => $paire) {
            if (! is_array($paire)) {
                continue;
            }

            $sensible = preg_match(self::CLES_SENSIBLES, (string) $attribut) === 1;
            $propres[(string) $attribut] = $sensible
                ? ['old' => ($paire['old'] ?? null) === null ? null : RecordModelChange::MASQUE, 'new' => ($paire['new'] ?? null) === null ? null : RecordModelChange::MASQUE]
                : ['old' => self::scalaire($paire['old'] ?? null), 'new' => self::scalaire($paire['new'] ?? null)];
        }

        return $propres;
    }

    /**
     * @param  array<string, mixed>|null  $metadata
     * @return array<string, bool|int|float|string|null>
     */
    public static function metadata(string $action, ?array $metadata): array
    {
        $servies = [];

        foreach (ActivityCatalog::metadataKeys($action) as $cle) {
            $valeur = $metadata[$cle] ?? null;

            if (is_string($valeur)) {
                $valeur = mb_substr($valeur, 0, self::METADATA_TEXTE_MAX);
            }

            if (is_scalar($valeur) || $valeur === null) {
                $servies[$cle] = $valeur;
            }
        }

        return $servies;
    }

    private static function scalaire(mixed $valeur): mixed
    {
        if (is_array($valeur)) {
            return RecordModelChange::MASQUE;
        }

        return is_string($valeur) ? mb_substr($valeur, 0, 500) : $valeur;
    }
}
