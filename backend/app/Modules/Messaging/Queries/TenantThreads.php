<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Queries;

use App\Modules\Leases\PublicApi\LeaseDirectory;
use App\Modules\Messaging\Enums\ConversationKind;
use App\Modules\Messaging\Enums\MessageSide;
use App\Modules\Messaging\Models\Conversation;
use App\Modules\Parties\PublicApi\PartyLinks;
use App\Shared\Tenancy\AcrossOrganizations;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Str;

/**
 * Fils d'un locataire, toutes organisations confondues (ADR 0033, invariant 3) : la clé est le triplet (organisation, fiche rattachée
 * au compte, bail de `visibleToTenant()`), évaluée à chaque requête. Un fil hors de la clé, ou d'un colocataire, n'existe pas.
 */
final readonly class TenantThreads
{
    public function __construct(
        private LeaseDirectory $baux,
        private PartyLinks $liens,
    ) {}

    /**
     * @return array<string, array{party: string, leases: list<string>}> par organisation
     */
    public function keys(string $userId, CarbonImmutable $today): array
    {
        $parties = [];

        foreach ($this->liens->linkedTo($userId) as $lien) {
            $parties[$lien->organizationId] = $lien->partyId;
        }

        $cles = [];

        foreach ($this->baux->visibleToTenant($userId, $today) as $bail) {
            if (isset($parties[$bail->organizationId])) {
                $cles[$bail->organizationId]['party'] = $parties[$bail->organizationId];
                $cles[$bail->organizationId]['leases'][] = $bail->leaseId;
            }
        }

        return $cles;
    }

    /**
     * @return Builder<Conversation>
     */
    public function visible(string $userId, CarbonImmutable $today): Builder
    {
        $requete = AcrossOrganizations::query(Conversation::class)->where('conversations.kind', ConversationKind::Tenant->value);
        $cles = $this->keys($userId, $today);

        if ($cles === []) {
            return $requete->whereRaw('1 = 0');
        }

        return $requete->where(function (Builder $groupe) use ($cles): void {
            foreach ($cles as $organisation => $cle) {
                $groupe->orWhere(fn (Builder $paire) => $paire
                    ->where('conversations.organization_id', $organisation)
                    ->where('conversations.party_id', $cle['party'])
                    ->whereIn('conversations.lease_id', $cle['leases']));
            }
        });
    }

    public function find(string $userId, string $id, CarbonImmutable $today): ?Conversation
    {
        return Str::isUuid($id) ? $this->visible($userId, $today)->whereKey($id)->first() : null;
    }

    /**
     * @return Builder<Conversation>
     */
    public function list(string $userId, CarbonImmutable $today): Builder
    {
        return ThreadScopes::withReadState($this->visible($userId, $today), $userId, [MessageSide::Staff]);
    }
}
