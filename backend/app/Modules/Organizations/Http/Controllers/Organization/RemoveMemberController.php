<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Http\Controllers\Organization;

use App\Modules\Organizations\Actions\RemoveMember;
use App\Modules\Organizations\Support\OrganizationContext;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

final class RemoveMemberController
{
    public function __invoke(Request $request, string $member, RemoveMember $retirer): Response
    {
        $retirer->handle(OrganizationContext::findMember($member), OrganizationContext::member($request));

        return response()->noContent();
    }
}
