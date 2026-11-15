<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Http\Controllers\Organization;

use App\Modules\Organizations\Actions\InviteMember;
use App\Modules\Organizations\Http\Requests\InviteMemberRequest;
use App\Modules\Organizations\Http\Resources\MemberResource;
use App\Modules\Organizations\Support\OrganizationContext;
use Illuminate\Http\JsonResponse;

final class InviteMemberController
{
    public function __invoke(InviteMemberRequest $request, InviteMember $inviter): JsonResponse
    {
        $membre = $inviter->handle(OrganizationContext::organization($request), OrganizationContext::member($request), $request->toData());

        return (new MemberResource($membre->load('user')))->response()->setStatusCode(201);
    }
}
