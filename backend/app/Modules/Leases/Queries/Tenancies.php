<?php

declare(strict_types=1);

namespace App\Modules\Leases\Queries;

use App\Modules\Leases\Models\LeaseParty;
use App\Modules\Leases\Support\LeasePhaseResolver;
use App\Modules\Leases\Support\LeaseView;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;

final readonly class Tenancies
{
    public const int MAX_LINES_PER_PARTY = 50;

    public function __construct(
        private LeasePhaseResolver $phases,
        private LeaseViews $vues,
        private CurrentOrganization $organisation,
    ) {}

    /**
     * Les baux non archivés de chaque partie, du plus récent au plus ancien, dans la limite de MAX_LINES_PER_PARTY par partie.
     * Lève party_not_found si une partie est inconnue ou hors de l'organisation.
     *
     * @param  list<string>  $partyIds
     * @return list<TenancyEntry>
     */
    public function of(array $partyIds): array
    {
        $partyIds = array_values(array_unique($partyIds));
        $parties = $this->vues->partyData($partyIds);
        $jour = CarbonImmutable::today();

        $retenues = DB::query()->fromSub(
            DB::table('lease_parties')
                ->join('leases', 'leases.id', '=', 'lease_parties.lease_id')
                ->where('lease_parties.organization_id', $this->organisation->id())
                ->whereNull('leases.archived_at')
                ->whereIn('lease_parties.party_id', $partyIds)
                ->selectRaw('lease_parties.id as id, row_number() over (partition by lease_parties.party_id order by lease_parties.valid_from desc, lease_parties.id desc) as rang'),
            'classes',
        )->where('rang', '<=', self::MAX_LINES_PER_PARTY)->select('id');

        $liens = LeaseParty::query()
            ->whereIn('id', $retenues)
            ->with(['lease.units' => fn ($q) => $q->where('is_main', true)])
            ->orderByDesc('valid_from')
            ->orderByDesc('id')
            ->get();

        $principaux = [];

        foreach ($liens as $lien) {
            $principaux[$lien->id] = LeaseView::mainOf($lien->lease->units, $jour);
        }

        $lots = $this->vues->unitData(array_values(array_map(fn ($u) => $u->unit_id, array_filter($principaux))));

        return array_map(fn (string $id): TenancyEntry => new TenancyEntry($parties[$id], array_values(
            $liens->where('party_id', $id)->map(fn (LeaseParty $lien): TenancyLine => new TenancyLine(
                lease: $lien->lease,
                link: $lien,
                phase: $this->phases->at($lien->lease, $jour),
                mainUnit: isset($principaux[$lien->id]) ? $lots[$principaux[$lien->id]->unit_id] : null,
            ))->all(),
        )), $partyIds);
    }
}
