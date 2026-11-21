<?php

declare(strict_types=1);

namespace App\Modules\Leases\Jurisdictions\Fr;

use App\Modules\Leases\Data\NoticeReason;
use App\Modules\Leases\Enums\ErrorCode;
use App\Modules\Leases\Jurisdictions\RegimeField;
use Carbon\CarbonImmutable;

final class FrFields
{
    public const array ENERGY_CLASSES = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

    public const array REDUCED_NOTICE_REASONS = [
        'first_employment', 'transfer', 'job_loss', 'new_job_after_loss', 'health', 'domestic_violence', 'minimum_income', 'social_housing',
    ];

    public const string STANDARD_NOTICE = 'standard';

    /**
     * Le motif « violences » (art. 8-2) est volontairement absent : il ne passe pas par le parcours en ligne (ADR 0036).
     */
    private const array ONLINE_REDUCED_NOTICE_LABELS = [
        'first_employment' => 'Obtention d\'un premier emploi',
        'transfer' => 'Mutation professionnelle',
        'job_loss' => 'Perte d\'emploi',
        'new_job_after_loss' => 'Nouvel emploi consécutif à une perte d\'emploi',
        'health' => 'État de santé justifiant un changement de domicile',
        'minimum_income' => 'Bénéficiaire du RSA ou de l\'AAH',
        'social_housing' => 'Attribution d\'un logement social',
    ];

    /**
     * @return list<NoticeReason>
     */
    public static function standardNotice(int $months): array
    {
        return [new NoticeReason(self::STANDARD_NOTICE, 'Préavis de droit commun', $months, false)];
    }

    /**
     * @return list<NoticeReason>
     */
    public static function reducedNoticeReasons(): array
    {
        return array_map(
            fn (string $cle, string $libelle): NoticeReason => new NoticeReason($cle, $libelle, 1, true),
            array_keys(self::ONLINE_REDUCED_NOTICE_LABELS),
            array_values(self::ONLINE_REDUCED_NOTICE_LABELS),
        );
    }

    /**
     * @param  list<NoticeReason>  $motifs
     */
    public static function earliestDeparture(array $motifs, CarbonImmutable $recu, string $cle): CarbonImmutable
    {
        foreach ($motifs as $motif) {
            if ($motif->key === $cle) {
                return $recu->addMonthsNoOverflow($motif->months);
            }
        }

        throw ErrorCode::NoticeReasonUnsupported->problem();
    }

    public static function revisionIndex(): RegimeField
    {
        return RegimeField::choice('revision_index', ['irl']);
    }

    public static function irlReferenceQuarter(): RegimeField
    {
        return RegimeField::text('irl_reference_quarter', '/^\d{4}-T[1-4]$/');
    }

    public static function tenseZone(): RegimeField
    {
        return RegimeField::boolean('tense_zone');
    }

    public static function rentControl(): RegimeField
    {
        return RegimeField::boolean('rent_control');
    }

    public static function energyClass(): RegimeField
    {
        return RegimeField::choice('energy_class', self::ENERGY_CLASSES);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public static function flag(array $data, string $key): bool
    {
        return filter_var($data[$key] ?? false, FILTER_VALIDATE_BOOLEAN);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public static function revisionExcluded(array $data): bool
    {
        return in_array($data['energy_class'] ?? null, ['F', 'G'], true);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public static function annualRevision(CarbonImmutable $startsOn, ?CarbonImmutable $lastRevisionOn, array $data): ?CarbonImmutable
    {
        if (self::revisionExcluded($data)) {
            return null;
        }

        return ($lastRevisionOn ?? $startsOn)->addYearsNoOverflow(1);
    }
}
