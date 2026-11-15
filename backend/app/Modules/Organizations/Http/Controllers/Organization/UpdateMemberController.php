<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Http\Controllers\Organization;

use App\Modules\Organizations\Actions\ChangeMemberAccess;
use App\Modules\Organizations\Http\Requests\UpdateMemberRequest;
use App\Modules\Organizations\Http\Resources\MemberResource;
use App\Modules\Organizations\Support\OrganizationContext;

final class UpdateMemberController
{
    public function __invoke(UpdateMemberRequest $request, string $member, ChangeMemberAccess $modifier): MemberResource
    {
        $membre = $modifier->handle(OrganizationContext::findMember($member), OrganizationContext::member($request), $request->role(), $request->scope());

        return new MemberResource($membre);
    }
}
