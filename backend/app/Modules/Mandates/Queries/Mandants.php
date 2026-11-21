<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Queries;

use App\Modules\Mandates\Data\MandantData;
use App\Modules\Mandates\Enums\MandateStatus;
use App\Modules\Mandates\Models\Mandate;
use App\Modules\Parties\PublicApi\PartyDirectory;
use Carbon\CarbonImmutable;
use Illuminate\Support\Str;

/**
 * Mandants de l'organisation courante : les parties qui portent au moins un mandat non archivé. L'identité reste dans Parties.
 */
final readonly class Mandants
{
    public const int MAX_PAGE = 200;

    public function __construct(private PartyDirectory $parties) {}

    /**
     * Pagination par l'identifiant de la dernière partie reçue ; « en cours » : actif, suspendu ou résilié avec préavis.
     *
     * @return list<MandantData>
     */
    public function list(?string $afterPartyId, int $limit, CarbonImmutable $today): array
    {
        $enCours = [MandateStatus::Active->value, MandateStatus::Suspended->value, MandateStatus::Terminated->value];

        $lignes = Mandate::query()
            ->whereNull('archived_at')
            ->when($afterPartyId !== null && Str::isUuid($afterPartyId), fn ($q) => $q->where('mandant_party_id', '>', (string) $afterPartyId))
            ->groupBy('mandant_party_id')
            ->orderBy('mandant_party_id')
            ->limit(max(1, min($limit, self::MAX_PAGE)))
            ->selectRaw(
                'mandant_party_id, COUNT(*) AS total, SUM(CASE WHEN status IN (?, ?, ?) AND ends_on > ? THEN 1 ELSE 0 END) AS running',
                [...$enCours, $today->toDateString()],
            )
            ->get();

        $noms = $this->parties->findMany(array_values($lignes->map(fn (Mandate $l): string => $l->mandant_party_id)->all()));

        return array_values($lignes->map(fn (Mandate $l): MandantData => new MandantData(
            partyId: $l->mandant_party_id,
            displayName: $noms[$l->mandant_party_id]->displayName,
            mandateCount: (int) $l->getAttribute('total'),
            runningMandateCount: (int) $l->getAttribute('running'),
        ))->all());
    }
}
