<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Http\Controllers\Owner;

use App\Modules\Identity\Models\User;
use App\Modules\OwnerFunds\Actions\ContestPayoutAccount;
use App\Modules\OwnerFunds\Http\Requests\ContestPayoutAccountRequest;
use App\Modules\OwnerFunds\Support\OwnerPayoutGate;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Http\JsonResponse;

final class ContestOwnerPayoutAccountController
{
    public function __invoke(ContestPayoutAccountRequest $request, OwnerPayoutGate $porte, CurrentOrganization $contexte, ContestPayoutAccount $action): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $visible = $porte->visible($user->id, $request->accessId());

        $retenue = $contexte->run($visible->organizationId, function () use ($porte, $visible, $action, $user) {
            $porte->assertWritable($visible);

            return $action->handle($visible->mandantPartyId, $user->id);
        });

        return response()->json(['data' => ['access_id' => $visible->accessId, 'contested' => true, 'contested_at' => $retenue->created_at?->toIso8601String()]]);
    }
}
