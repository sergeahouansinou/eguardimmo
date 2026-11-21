<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Queries;

use App\Modules\Mandates\Data\OwnerVisibleData;
use App\Modules\Mandates\Enums\MandateStatus;
use App\Modules\Mandates\Models\Mandate;
use App\Modules\Mandates\Support\OwnerWindow;
use App\Modules\Parties\Data\OwnerLinkData;
use App\Modules\Parties\PublicApi\OwnerLinks;
use App\Shared\Tenancy\AcrossOrganizations;
use Carbon\CarbonImmutable;

final readonly class OwnerVisibility
{
    public function __construct(private OwnerLinks $liens) {}

    /**
     * Deux requêtes quel que soit le nombre de mandants : les accès du compte, puis les mandats de ces mandants regroupés par
     * (organisation, mandant). Un brouillon et un mandat archivé ne comptent pas.
     *
     * @return list<OwnerVisibleData>
     */
    public function of(string $userId, ?string $organizationId, CarbonImmutable $today): array
    {
        $liens = array_values(array_filter(
            $this->liens->activeFor($userId),
            fn (OwnerLinkData $lien): bool => $organizationId === null || $lien->organizationId === strtolower($organizationId),
        ));

        if ($liens === []) {
            return [];
        }

        $mandats = AcrossOrganizations::query(Mandate::class)
            ->whereIn('mandant_party_id', array_values(array_unique(array_map(fn (OwnerLinkData $l): string => $l->mandantPartyId, $liens))))
            ->whereNull('archived_at')
            ->where('status', '<>', MandateStatus::Draft->value)
            ->groupBy('organization_id', 'mandant_party_id')
            ->selectRaw(
                'organization_id, mandant_party_id, MAX(CASE WHEN status IN (?, ?) THEN 1 ELSE 0 END) AS running, MAX(CASE WHEN status IN (?, ?) THEN ends_on END) AS last_ends_on',
                [MandateStatus::Active->value, MandateStatus::Suspended->value, MandateStatus::Terminated->value, MandateStatus::Expired->value],
            )
            ->get()
            ->keyBy(fn (Mandate $m): string => $m->organization_id.'|'.$m->mandant_party_id);

        $visibles = [];

        foreach ($liens as $lien) {
            $ligne = $mandats->get($lien->organizationId.'|'.$lien->mandantPartyId);
            $fenetre = $ligne === null ? null : OwnerWindow::resolve(
                (int) $ligne->getAttribute('running') === 1,
                $ligne->getAttribute('last_ends_on') === null ? null : substr((string) $ligne->getAttribute('last_ends_on'), 0, 10),
                $today,
            );

            if ($fenetre !== null) {
                $visibles[] = new OwnerVisibleData(
                    accessId: $lien->accessId,
                    organizationId: $lien->organizationId,
                    mandantPartyId: $lien->mandantPartyId,
                    mandantName: $lien->mandantName,
                    role: $lien->role,
                    personPartyId: $lien->personPartyId,
                    accessUntil: $fenetre['until'],
                    inGrace: $fenetre['inGrace'],
                );
            }
        }

        return $visibles;
    }
}
