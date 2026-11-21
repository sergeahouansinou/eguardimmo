<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Controllers\Tenant;

use App\Modules\Documents\Data\FileSource;
use App\Modules\Identity\Models\User;
use App\Modules\Leases\Actions\SubmitLeaseInsurance;
use App\Modules\Leases\Enums\ErrorCode;
use App\Modules\Leases\Http\Requests\SubmitInsuranceRequest;
use App\Modules\Leases\Http\Resources\Tenant\TenantInsuranceSubmissionResource;
use App\Modules\Leases\Queries\TenantStandings;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;

final class SubmitTenantInsuranceController
{
    public function __invoke(string $lease, SubmitInsuranceRequest $request, TenantStandings $positions, SubmitLeaseInsurance $action): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $position = $positions->find($user->id, $lease, CarbonImmutable::today()) ?? throw ErrorCode::LeaseNotFound->problem();
        $fichier = $request->uploaded();

        $resultat = $action->handle(
            $position,
            $user,
            FileSource::path((string) $fichier->getRealPath()),
            $fichier->getClientOriginalName(),
            (string) $request->validated('insurer'),
            (string) $request->validated('policy_number'),
            $request->startsOn(),
            $request->endsOn(),
            (string) $request->validated('client_id'),
        );

        return (new TenantInsuranceSubmissionResource($resultat['submission']))->response()->setStatusCode($resultat['replayed'] ? 200 : 201);
    }
}
