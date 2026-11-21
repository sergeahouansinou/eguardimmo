<?php

declare(strict_types=1);

namespace App\Modules\Parties\Queries;

use App\Modules\Identity\Enums\OwnerAccessRole;
use App\Modules\Identity\PublicApi\OwnerInvitations;
use App\Modules\Parties\Data\OwnerAccessStateData;
use App\Modules\Parties\Data\OwnerLinkData;
use App\Modules\Parties\Enums\OwnerAccessStatus;
use App\Modules\Parties\Models\OwnerAccess;
use App\Modules\Parties\Models\Party;
use App\Shared\Tenancy\AcrossOrganizations;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Str;

final readonly class OwnerAccesses
{
    public function __construct(private OwnerInvitations $invitations) {}

    /**
     * Accès vivants du compte, toutes organisations confondues, sur des mandants non anonymisés. Une requête, nom du mandant compris.
     *
     * @return list<OwnerLinkData>
     */
    public function activeOf(string $userId): array
    {
        $acces = AcrossOrganizations::query(OwnerAccess::class)
            ->join('parties', fn ($jointure) => $jointure
                ->on('parties.id', '=', 'owner_accesses.mandant_party_id')
                ->on('parties.organization_id', '=', 'owner_accesses.organization_id'))
            ->where('owner_accesses.user_id', $userId)
            ->where('owner_accesses.status', OwnerAccessStatus::Active)
            ->whereNull('parties.anonymized_at')
            ->orderBy('owner_accesses.created_at')
            ->orderBy('owner_accesses.id')
            ->get(['owner_accesses.*', 'parties.display_name as mandant_name']);

        return array_values($acces->map(fn (OwnerAccess $a): OwnerLinkData => new OwnerLinkData(
            accessId: $a->id,
            organizationId: $a->organization_id,
            mandantPartyId: $a->mandant_party_id,
            mandantName: (string) $a->getAttribute('mandant_name'),
            role: $a->role,
            personPartyId: $a->person_party_id,
            linkedAt: CarbonImmutable::instance($a->consented_at),
        ))->all());
    }

    /**
     * Accès vivant d'un compte, cherché par son identifiant : null hors du compte, révoqué ou inconnu.
     */
    public function activeOfUser(string $userId, string $accessId): ?OwnerAccess
    {
        if (! Str::isUuid($accessId)) {
            return null;
        }

        return AcrossOrganizations::query(OwnerAccess::class)
            ->whereKey($accessId)
            ->where('user_id', $userId)
            ->where('status', OwnerAccessStatus::Active)
            ->first();
    }

    /**
     * Accès vivant du mandant de l'organisation courante, par identifiant.
     */
    public function activeOfMandant(string $mandantPartyId, string $accessId): ?OwnerAccess
    {
        if (! Str::isUuid($accessId)) {
            return null;
        }

        return OwnerAccess::query()
            ->whereKey($accessId)
            ->where('mandant_party_id', $mandantPartyId)
            ->where('status', OwnerAccessStatus::Active)
            ->first();
    }

    public function userHoldsActive(string $mandantPartyId, string $userId): bool
    {
        return OwnerAccess::query()->where('mandant_party_id', $mandantPartyId)->where('user_id', $userId)->where('status', OwnerAccessStatus::Active)->exists();
    }

    /**
     * Accès vivants des parties (mandant ou personne), dans l'organisation courante, verrouillés.
     *
     * @param  list<string>  $partyIds
     * @return Collection<int, OwnerAccess>
     */
    public function activeOfParties(array $partyIds): Collection
    {
        return OwnerAccess::query()
            ->where('status', OwnerAccessStatus::Active)
            ->where(fn ($q) => $q->whereIn('mandant_party_id', $partyIds)->orWhereIn('person_party_id', $partyIds))
            ->lockForUpdate()
            ->get();
    }

    /**
     * Accès vivants d'un compte, toutes organisations confondues, même sur un mandant anonymisé (effacement du compte).
     *
     * @return Collection<int, OwnerAccess>
     */
    public function allActiveOfAccount(string $userId): Collection
    {
        return AcrossOrganizations::query(OwnerAccess::class)
            ->where('user_id', $userId)
            ->where('status', OwnerAccessStatus::Active)
            ->get();
    }

    /**
     * Comptes à accès vivant du mandant de l'organisation courante, pour les rôles donnés.
     *
     * @param  list<OwnerAccessRole>  $roles
     * @return list<string>
     */
    public function accountsOfMandant(string $mandantPartyId, array $roles): array
    {
        return array_values(array_map(
            fn (mixed $id): string => (string) $id,
            OwnerAccess::query()->where('mandant_party_id', $mandantPartyId)->where('status', OwnerAccessStatus::Active)
                ->whereIn('role', array_map(fn (OwnerAccessRole $role): string => $role->value, $roles))->distinct()->pluck('user_id')->all(),
        ));
    }

    /**
     * @param  list<string>  $mandantPartyIds
     * @param  list<OwnerAccessRole>  $roles
     * @return array<string, list<string>> comptes par mandant, ordre stable
     */
    public function accountsOfMandants(array $mandantPartyIds, array $roles): array
    {
        $comptes = [];

        foreach (OwnerAccess::query()->whereIn('mandant_party_id', $mandantPartyIds)->where('status', OwnerAccessStatus::Active)
            ->whereIn('role', array_map(fn (OwnerAccessRole $role): string => $role->value, $roles))->orderBy('id')->get(['mandant_party_id', 'user_id']) as $acces) {
            $comptes[$acces->mandant_party_id][(string) $acces->user_id] = (string) $acces->user_id;
        }

        return array_map(fn (array $ids): array => array_values($ids), $comptes);
    }

    public function countActiveOfMandant(string $mandantPartyId): int
    {
        return OwnerAccess::query()->where('mandant_party_id', $mandantPartyId)->where('status', OwnerAccessStatus::Active)->count();
    }

    public function existsActive(string $mandantPartyId, string $userId): bool
    {
        return OwnerAccess::query()->where('mandant_party_id', $mandantPartyId)->where('user_id', $userId)->where('status', OwnerAccessStatus::Active)->exists();
    }

    /**
     * Suppose un contexte d'organisation. Accès vivants et invitations en attente du mandant ; adresses masquées.
     */
    public function stateOf(Party $mandant): OwnerAccessStateData
    {
        $acces = OwnerAccess::query()
            ->where('mandant_party_id', $mandant->id)
            ->where('status', OwnerAccessStatus::Active)
            ->orderBy('created_at')
            ->orderBy('id')
            ->get();
        $indices = $this->invitations->emailHints(array_values($acces->pluck('invitation_id')->all()));

        return new OwnerAccessStateData(
            partyId: $mandant->id,
            accesses: array_values($acces->map(fn (OwnerAccess $a): array => [
                'id' => $a->id,
                'role' => $a->role->value,
                'person_party_id' => $a->person_party_id,
                'email_hint' => $indices[$a->invitation_id] ?? null,
                'linked_at' => $a->consented_at->toIso8601String(),
            ])->all()),
            invitations: $this->invitations->pendingForMandant($mandant->id),
        );
    }
}
