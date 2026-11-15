<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Queries;

use App\Modules\Organizations\Data\MembershipData;
use App\Modules\Organizations\Data\TeamMemberData;
use App\Modules\Organizations\Enums\MemberStatus;
use App\Modules\Organizations\Models\Organization;
use App\Modules\Organizations\Models\OrganizationMember;
use App\Shared\Tenancy\AcrossOrganizations;

final class Memberships
{
    /**
     * @return list<MembershipData>
     */
    public function activeFor(string $userId): array
    {
        $membres = AcrossOrganizations::query(OrganizationMember::class)
            ->where('user_id', $userId)
            ->where('status', MemberStatus::Active)
            ->orderBy('created_at')
            ->get();

        $organisations = Organization::query()->whereIn('id', $membres->pluck('organization_id'))->get()->keyBy('id');

        return array_values($membres
            ->filter(fn (OrganizationMember $membre): bool => $organisations->has($membre->organization_id))
            ->map(function (OrganizationMember $membre) use ($organisations): MembershipData {
                /** @var Organization $organisation */
                $organisation = $organisations->get($membre->organization_id);

                return new MembershipData($organisation->id, $organisation->name, $organisation->kind, $membre->id, $membre->role);
            })
            ->all());
    }

    public function activeMember(string $userId, string $organizationId): ?OrganizationMember
    {
        return AcrossOrganizations::query(OrganizationMember::class)
            ->where('organization_id', $organizationId)
            ->where('user_id', $userId)
            ->where('status', MemberStatus::Active)
            ->first();
    }

    public function pendingInvitation(string $tokenHash): ?OrganizationMember
    {
        return AcrossOrganizations::query(OrganizationMember::class)
            ->where('invitation_token_hash', $tokenHash)
            ->where('status', MemberStatus::Invited)
            ->where('invitation_expires_at', '>', now())
            ->first();
    }

    /**
     * @return list<TeamMemberData>
     */
    public function activeTeam(): array
    {
        return array_values(OrganizationMember::query()
            ->where('status', MemberStatus::Active)
            ->whereNotNull('user_id')
            ->orderBy('last_name')
            ->get()
            ->map(fn (OrganizationMember $membre): TeamMemberData => new TeamMemberData((string) $membre->user_id, $membre->first_name, $membre->last_name, $membre->role))
            ->all());
    }
}
