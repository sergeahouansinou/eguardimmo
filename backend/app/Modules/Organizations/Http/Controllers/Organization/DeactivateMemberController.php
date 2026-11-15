<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Http\Controllers\Organization;

use App\Modules\Organizations\Actions\DeactivateMember;
use App\Modules\Organizations\Http\Resources\MemberResource;
use App\Modules\Organizations\Support\OrganizationContext;
use Illuminate\Http\Request;

final class DeactivateMemberController
{
    public function __invoke(Request $request, string $member, DeactivateMember $desactiver): MemberResource
    {
        return new MemberResource($desactiver->handle(OrganizationContext::findMember($member), OrganizationContext::member($request)));
    }
}
