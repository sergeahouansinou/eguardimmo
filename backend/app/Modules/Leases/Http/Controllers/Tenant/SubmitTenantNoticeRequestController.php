<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Controllers\Tenant;

use App\Modules\Documents\Data\FileSource;
use App\Modules\Identity\Models\User;
use App\Modules\Leases\Actions\SubmitNoticeRequest;
use App\Modules\Leases\Data\NewNoticeRequestData;
use App\Modules\Leases\Enums\ErrorCode;
use App\Modules\Leases\Http\Requests\SubmitNoticeRequestRequest;
use App\Modules\Leases\Http\Resources\Tenant\TenantNoticeRequestResource;
use App\Modules\Leases\Queries\TenantStandings;
use App\Modules\Leases\Support\ProofContexts;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;

final class SubmitTenantNoticeRequestController
{
    public function __invoke(string $lease, SubmitNoticeRequestRequest $request, TenantStandings $positions, ProofContexts $contextes, SubmitNoticeRequest $action): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $position = $positions->find($user->id, $lease, CarbonImmutable::today()) ?? throw ErrorCode::LeaseNotFound->problem();
        $justificatif = $request->proof();

        $resultat = $action->handle($position, $user, new NewNoticeRequestData(
            (string) $request->validated('reason_key'),
            $request->departureOn(),
            $request->forwardingAddress(),
            (string) $request->validated('consent_version'),
            (string) $request->validated('client_id'),
            $justificatif === null ? null : FileSource::path((string) $justificatif->getRealPath()),
            $justificatif?->getClientOriginalName(),
        ), $contextes->of($request));

        return (new TenantNoticeRequestResource($resultat['request']))->response()->setStatusCode($resultat['replayed'] ? 200 : 201);
    }
}
