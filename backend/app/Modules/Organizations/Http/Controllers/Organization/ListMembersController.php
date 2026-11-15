<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Http\Controllers\Organization;

use App\Modules\Organizations\Http\Resources\MemberResource;
use App\Modules\Organizations\Models\OrganizationMember;
use App\Modules\Organizations\Support\OrganizationContext;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class ListMembersController
{
    public function __invoke(Request $request): AnonymousResourceCollection
    {
        $organisation = OrganizationContext::organization($request);

        $membres = OrganizationMember::query()
            ->with('user')
            ->orderByRaw("case role when 'owner' then 0 when 'admin' then 1 when 'manager' then 2 else 3 end")
            ->orderBy('last_name')
            ->orderBy('first_name')
            ->get();

        return MemberResource::collection($membres)->additional([
            'meta' => ['two_factor_required' => $organisation->two_factor_required, 'seat_limit' => null],
        ]);
    }
}
