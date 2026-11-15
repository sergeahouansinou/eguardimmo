<?php

declare(strict_types=1);

namespace App\Modules\Documents\Support;

use App\Modules\Catalog\Data\TermData;
use App\Modules\Catalog\Enums\VocabularyKey;
use App\Modules\Catalog\PublicApi\TermDirectory;

/**
 * Types de pièces à échéance de l'organisation courante, mémorisés le temps de la requête.
 */
final class CertificateTypes
{
    public const DEFAULT_REMINDER_DAYS = 0;

    /** @var array<string, TermData> */
    private array $termes = [];

    public function __construct(private readonly TermDirectory $referentiel) {}

    public function find(string $id): TermData
    {
        return $this->termes[$id] ??= $this->referentiel->find($id, VocabularyKey::CertificateType);
    }

    public function assignable(string $id): TermData
    {
        $terme = $this->referentiel->findAssignable($id, VocabularyKey::CertificateType);

        return $this->termes[$id] = $terme;
    }

    public function reminderDays(TermData $type): int
    {
        $jours = $type->metadata['reminder_days'] ?? null;

        return is_int($jours) ? $jours : self::DEFAULT_REMINDER_DAYS;
    }

    public function defaultValidityMonths(TermData $type): ?int
    {
        $mois = $type->metadata['default_validity_months'] ?? null;

        return is_int($mois) ? $mois : null;
    }

    /**
     * @return array<string, mixed>
     */
    public function dataSchema(TermData $type): array
    {
        $schema = $type->metadata['data_schema'] ?? [];

        return is_array($schema) ? $schema : [];
    }
}
