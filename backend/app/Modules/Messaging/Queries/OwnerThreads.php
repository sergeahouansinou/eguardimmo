<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Queries;

use App\Modules\Identity\Enums\OwnerAccessRole;
use App\Modules\Mandates\Data\OwnerScopeData;
use App\Modules\Mandates\Data\OwnerVisibleData;
use App\Modules\Mandates\Enums\ErrorCode as MandatesError;
use App\Modules\Mandates\PublicApi\MandateDirectory;
use App\Modules\Messaging\Enums\ConversationKind;
use App\Modules\Messaging\Enums\MessageSide;
use App\Modules\Messaging\Models\Conversation;
use App\Shared\Tenancy\AcrossOrganizations;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Str;

/**
 * Fils d'un compte propriétaire : la clé est le couple (organisation, mandant) de `visibleToOwner()` pour un accès `holder` ou
 * `representative` ; un `co_owner` n'a pas de messagerie (ADR 0032, 0033). Le fil est partagé par les comptes du mandant.
 */
final readonly class OwnerThreads
{
    public const array ROLES = [OwnerAccessRole::Holder, OwnerAccessRole::Representative];

    public function __construct(private MandateDirectory $mandats) {}

    /**
     * `$agence` restreint seulement : un identifiant mal formé ou hors clé lève owner_agency_not_found.
     *
     * @return list<OwnerVisibleData>
     */
    public function visibles(string $userId, ?string $agence = null): array
    {
        if ($agence !== null && ! Str::isUuid($agence)) {
            throw MandatesError::OwnerAgencyNotFound->problem();
        }

        $visibles = $this->mandats->visibleToOwner($userId, $agence);

        if ($agence !== null && $visibles === []) {
            throw MandatesError::OwnerAgencyNotFound->problem();
        }

        return array_values(array_filter($visibles, fn (OwnerVisibleData $v): bool => in_array($v->role, self::ROLES, true)));
    }

    /**
     * @param  list<OwnerVisibleData>  $visibles
     * @return Builder<Conversation>
     */
    public function visible(array $visibles): Builder
    {
        $requete = AcrossOrganizations::query(Conversation::class)->where('conversations.kind', ConversationKind::Owner->value);

        return (new OwnerScopeData($visibles, []))->restrictToMandants($requete, 'conversations.organization_id', 'conversations.party_id');
    }

    /**
     * @param  list<OwnerVisibleData>  $visibles
     * @return Builder<Conversation>
     */
    public function list(string $userId, array $visibles): Builder
    {
        return ThreadScopes::withReadState($this->visible($visibles), $userId, [MessageSide::Staff]);
    }

    /**
     * @param  list<OwnerVisibleData>  $visibles
     */
    public function find(array $visibles, string $id): ?Conversation
    {
        return Str::isUuid($id) ? $this->visible($visibles)->whereKey($id)->first() : null;
    }

    /**
     * @param  list<OwnerVisibleData>  $visibles
     */
    public function visibleOf(array $visibles, Conversation $fil): ?OwnerVisibleData
    {
        return (new OwnerScopeData($visibles, []))->visible($fil->organization_id, (string) $fil->party_id);
    }
}
