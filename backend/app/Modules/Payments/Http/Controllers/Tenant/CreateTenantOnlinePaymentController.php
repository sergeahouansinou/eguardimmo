<?php

declare(strict_types=1);

namespace App\Modules\Payments\Http\Controllers\Tenant;

use App\Modules\Identity\Models\User;
use App\Modules\Leases\Enums\ErrorCode;
use App\Modules\Leases\PublicApi\LeaseDirectory;
use App\Modules\Payments\Actions\CreateOnlinePayment;
use App\Modules\Payments\Http\Requests\CreateOnlinePaymentRequest;
use App\Modules\Payments\Http\Resources\TenantOnlinePaymentResource;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;

final class CreateTenantOnlinePaymentController
{
    public function __invoke(CreateOnlinePaymentRequest $request, LeaseDirectory $baux, CreateOnlinePayment $action): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $position = $baux->tenantStanding($user->id, (string) $request->validated('lease'), CarbonImmutable::today()) ?? throw ErrorCode::LeaseNotFound->problem();
        $resultat = $action->handle($position, $user, $request->installmentIds(), $request->paymentMethod(), (string) $request->validated('client_id'));

        return (new TenantOnlinePaymentResource($resultat['payment']))->response()->setStatusCode($resultat['replayed'] ? 200 : 201);
    }
}
