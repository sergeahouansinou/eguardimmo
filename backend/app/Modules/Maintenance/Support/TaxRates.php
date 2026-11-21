<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Support;

use App\Modules\Catalog\Data\TermData;
use App\Modules\Catalog\Enums\VocabularyKey;
use App\Modules\Catalog\PublicApi\TermDirectory;
use App\Modules\Maintenance\Enums\ErrorCode;
use App\Modules\Maintenance\Enums\TaxCategory;
use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use Carbon\CarbonImmutable;

/**
 * Taux déclarés par le prestataire, vérifiés contre les taux datés du Catalog : la clé du taux vient du client, la catégorie
 * et le taux en cent-millièmes viennent du référentiel.
 */
final class TaxRates
{
    /** @var list<TermData>|null */
    private ?array $taux = null;

    private ?string $pays = null;

    public function __construct(
        private readonly TermDirectory $referentiel,
        private readonly OrganizationDirectory $organisation,
    ) {}

    /**
     * @return array{category: TaxCategory, ratePcm: int}
     */
    public function resolve(string $cle, CarbonImmutable $date): array
    {
        $this->taux ??= $this->referentiel->list(VocabularyKey::TaxRate);
        $this->pays ??= $this->organisation->country();
        $jour = $date->toDateString();

        foreach ($this->taux as $terme) {
            $meta = $terme->metadata;

            if ($terme->key === $cle && ($meta['country'] ?? null) === $this->pays && ($meta['tax_code'] ?? null) === 'vat'
                && is_string($meta['effective_from'] ?? null) && $meta['effective_from'] <= $jour
                && (! is_string($meta['effective_to'] ?? null) || $meta['effective_to'] >= $jour)
                && is_int($meta['rate_pcm'] ?? null) && ($categorie = TaxCategory::tryFrom((string) ($meta['category'] ?? ''))) !== null) {
                return ['category' => $categorie, 'ratePcm' => $meta['rate_pcm']];
            }
        }

        throw ErrorCode::TaxRateUnknown->problem();
    }
}
