<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Http\Controllers\Organization;

use App\Modules\Organizations\Actions\ReactivateMember;
use App\Modules\Organizations\Http\Resources\MemberResource;
use App\Modules\Organizations\Support\OrganizationContext;

final class ReactivateMemberController
{
    public function __invoke(string $member, ReactivateMember $reactiver): MemberResource
    {
        return new MemberResource($reactiver->handle(OrganizationContext::findMember($member)));
    }
}
