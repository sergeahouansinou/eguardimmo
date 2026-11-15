<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Http\Controllers\Organization;

use App\Modules\Organizations\Actions\ResendInvitation;
use App\Modules\Organizations\Http\Resources\MemberResource;
use App\Modules\Organizations\Support\OrganizationContext;
use Illuminate\Http\Request;

final class ResendInvitationController
{
    public function __invoke(Request $request, string $member, ResendInvitation $renvoyer): MemberResource
    {
        $membre = $renvoyer->handle(OrganizationContext::organization($request), OrganizationContext::member($request), OrganizationContext::findMember($member));

        return new MemberResource($membre);
    }
}
