<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Http\Controllers\Owner;

use App\Modules\Identity\Models\User;
use App\Modules\Mandates\Actions\RequestMandateEnd;
use App\Modules\Mandates\Enums\ErrorCode;
use App\Modules\Mandates\Http\Requests\StoreMandateEndRequestRequest;
use App\Modules\Mandates\Http\Resources\Owner\OwnerMandateEndRequestResource;
use App\Modules\Mandates\Models\MandateEndRequest;
use App\Modules\Mandates\PublicApi\MandateDirectory;
use App\Modules\Mandates\Queries\OwnerMandates;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Http\JsonResponse;

final class StoreOwnerMandateEndRequestController
{
    public function __invoke(string $mandate, StoreMandateEndRequestRequest $request, MandateDirectory $repertoire, OwnerMandates $mandats, CurrentOrganization $contexte, RequestMandateEnd $action): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $portee = $repertoire->ownerScope($user->id);
        $mandat = $mandats->find($portee, $mandate) ?? throw ErrorCode::OwnerMandateNotFound->problem();
        $visible = $portee->visible($mandat->organization_id, $mandat->mandant_party_id) ?? throw ErrorCode::OwnerMandateNotFound->problem();
        $repertoire->assertOwnerWritable($visible);

        $demande = $contexte->run($mandat->organization_id, fn (): MandateEndRequest => $action->handle($mandat->id, $visible, $user->id, $request->reason()));

        return (new OwnerMandateEndRequestResource($demande))->response()->setStatusCode($demande->wasRecentlyCreated ? 201 : 200);
    }
}
