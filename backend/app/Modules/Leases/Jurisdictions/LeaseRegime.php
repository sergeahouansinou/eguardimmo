<?php

declare(strict_types=1);

namespace App\Modules\Leases\Jurisdictions;

use App\Modules\Leases\Data\NoticeReason;
use Carbon\CarbonImmutable;

interface LeaseRegime
{
    public function key(): string;

    public function jurisdiction(): string;

    public function label(): string;

    public function currency(): string;

    /**
     * @return list<RegimeField>
     */
    public function jurisdictionDataFields(): array;

    /**
     * @return array<string, list<string>>
     */
    public function jurisdictionDataRules(): array;

    /**
     * @param  array<string, mixed>  $jurisdictionData
     */
    public function defaultDurationMonths(array $jurisdictionData): int;

    /**
     * @param  array<string, mixed>  $jurisdictionData
     */
    public function minimumDurationMonths(array $jurisdictionData): int;

    /**
     * @param  array<string, mixed>  $jurisdictionData
     */
    public function maximumDurationMonths(array $jurisdictionData): ?int;

    /**
     * @param  array<string, mixed>  $jurisdictionData
     */
    public function tacitRenewal(array $jurisdictionData): bool;

    /**
     * @param  array<string, mixed>  $jurisdictionData
     */
    public function renewalMonths(array $jurisdictionData): ?int;

    /**
     * `null` : aucun plafond légal ; `0` : dépôt de garantie interdit.
     *
     * @param  array<string, mixed>  $jurisdictionData
     */
    public function depositCapMonths(array $jurisdictionData): ?int;

    /**
     * @param  array<string, mixed>  $jurisdictionData
     */
    public function tenantNoticeMonths(array $jurisdictionData): ?int;

    /**
     * Motifs de préavis que le locataire peut invoquer en ligne : liste fermée, vide si le régime n'en prévoit aucun.
     *
     * @param  array<string, mixed>  $jurisdictionData
     * @return list<NoticeReason>
     */
    public function tenantNoticeReasons(array $jurisdictionData): array;

    /**
     * Premier jour de départ permis pour un congé reçu à cette date, selon le motif retenu.
     *
     * @param  array<string, mixed>  $jurisdictionData
     */
    public function tenantEarliestDeparture(array $jurisdictionData, CarbonImmutable $receivedOn, string $reasonKey): CarbonImmutable;

    /**
     * @param  array<string, mixed>  $jurisdictionData
     */
    public function landlordNoticeMonths(array $jurisdictionData): ?int;

    /**
     * @param  array<string, mixed>  $jurisdictionData
     */
    public function nextRevisionDate(CarbonImmutable $startsOn, ?CarbonImmutable $lastRevisionOn, array $jurisdictionData): ?CarbonImmutable;
}
