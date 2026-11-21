<?php

declare(strict_types=1);

namespace App\Modules\Documents\Support;

use InvalidArgumentException;
use RuntimeException;

/**
 * Choix du pilote antivirus (`DOCUMENTS_MALWARE_SCANNER`) : `none` (développement), `clamd`, `fake` (tests). Une valeur inconnue lève une
 * exception, jamais un repli sur `none` ; en production, seul `clamd` démarre (ADR 0033, décision 13).
 */
final class ScannerDriver
{
    public const array PILOTES = ['none', 'clamd', 'fake'];

    public static function make(mixed $pilote, bool $production, string $adresse, int $delai): MalwareScanner
    {
        self::assertBootable($pilote, $production);

        return match ($pilote) {
            'clamd' => new ClamdScanner($adresse, $delai),
            'fake' => new FakeScanner,
            default => new NullScanner,
        };
    }

    public static function assertBootable(mixed $pilote, bool $production): void
    {
        if (! is_string($pilote) || ! in_array($pilote, self::PILOTES, true)) {
            throw new InvalidArgumentException('DOCUMENTS_MALWARE_SCANNER doit valoir none, clamd ou fake.');
        }

        if ($production && $pilote !== 'clamd') {
            throw new RuntimeException('En production, DOCUMENTS_MALWARE_SCANNER doit valoir clamd : les fichiers déposés ne peuvent pas rester sans analyse.');
        }
    }
}
