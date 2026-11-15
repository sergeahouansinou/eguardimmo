<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Controllers\Organization;

use App\Modules\Organizations\Data\TeamMemberData;
use App\Modules\Organizations\PublicApi\MembershipDirectory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class ListRecipientsController
{
    public function __invoke(Request $request, MembershipDirectory $annuaire): JsonResponse
    {
        $vis = $request->user()?->getAuthIdentifier();
        $equipe = array_filter($annuaire->activeTeam(), fn (TeamMemberData $m): bool => $m->userId !== $vis);

        return new JsonResponse(['data' => array_values(array_map(fn (TeamMemberData $m): array => [
            'id' => $m->userId,
            'name' => $m->firstName.' '.$m->lastName,
            'role' => $m->role->value,
        ], $equipe))]);
    }
}
