<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Queries;

use App\Modules\Mandates\Data\MandateSpanData;
use App\Modules\Mandates\PublicApi\MandateDirectory;
use App\Modules\Parties\PublicApi\PartyDirectory;
use App\Modules\Reporting\Enums\ReportStatus;
use App\Modules\Reporting\Models\ManagementReport;
use Carbon\CarbonImmutable;

/**
 * Mandants dont un mandat couvre la période sans qu'aucun compte rendu vivant (brouillon, généré ou publié) ne la couvre.
 */
final readonly class DueReports
{
    public function __construct(private MandateDirectory $mandats, private PartyDirectory $parties) {}

    /**
     * @return array{from: CarbonImmutable, to: CarbonImmutable}
     */
    public static function lastPeriod(CarbonImmutable $today): array
    {
        $debut = $today->startOfMonth()->subMonthNoOverflow();

        return ['from' => $debut, 'to' => $debut->endOfMonth()->startOfDay()];
    }

    /**
     * @return list<string>
     */
    public function mandantIds(CarbonImmutable $from, CarbonImmutable $to): array
    {
        $couverts = array_values(array_unique(array_map(fn (MandateSpanData $s): string => $s->mandantPartyId, $this->mandats->coverageDuring($from, $to))));

        if ($couverts === []) {
            return [];
        }

        $servis = ManagementReport::query()
            ->whereIn('mandant_party_id', $couverts)
            ->whereIn('status', [ReportStatus::Draft->value, ReportStatus::Generated->value, ReportStatus::Published->value])
            ->where('period_start', '<=', $to->toDateString())
            ->where('period_end', '>', $from->toDateString())
            ->pluck('mandant_party_id')->all();

        return array_values(array_diff($couverts, $servis));
    }

    /**
     * @param  list<string>  $mandantIds
     * @return list<array{party_id: string, name: string}>
     */
    public function named(array $mandantIds, int $limit): array
    {
        $noms = $this->parties->findMany(array_slice($mandantIds, 0, $limit));

        return array_values(array_map(fn ($p): array => ['party_id' => $p->id, 'name' => $p->displayName], $noms));
    }
}
