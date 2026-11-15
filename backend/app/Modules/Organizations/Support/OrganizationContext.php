<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Support;

use App\Modules\Organizations\Enums\ErrorCode;
use App\Modules\Organizations\Models\Organization;
use App\Modules\Organizations\Models\OrganizationMember;
use Illuminate\Http\Request;
use LogicException;

final class OrganizationContext
{
    private const ORGANISATION = 'organizations.organization';

    private const MEMBRE = 'organizations.member';

    public static function store(Request $request, Organization $organisation, OrganizationMember $membre): void
    {
        $request->attributes->set(self::ORGANISATION, $organisation);
        $request->attributes->set(self::MEMBRE, $membre);
    }

    public static function organization(Request $request): Organization
    {
        $organisation = $request->attributes->get(self::ORGANISATION);

        return $organisation instanceof Organization ? $organisation : throw new LogicException('Route hors espace organisation.');
    }

    public static function member(Request $request): OrganizationMember
    {
        $membre = $request->attributes->get(self::MEMBRE);

        return $membre instanceof OrganizationMember ? $membre : throw new LogicException('Route hors espace organisation.');
    }

    public static function findMember(string $id): OrganizationMember
    {
        return OrganizationMember::query()->with('user')->find($id)
            ?? throw ErrorCode::MemberNotFound->problem();
    }
}
