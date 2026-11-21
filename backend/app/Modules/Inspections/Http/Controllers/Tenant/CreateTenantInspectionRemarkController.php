<?php

declare(strict_types=1);

namespace App\Modules\Inspections\Http\Controllers\Tenant;

use App\Modules\Identity\Models\User;
use App\Modules\Inspections\Actions\RecordInspectionRemark;
use App\Modules\Inspections\Enums\ErrorCode;
use App\Modules\Inspections\Enums\RemarkKind;
use App\Modules\Inspections\Http\Requests\RecordInspectionRemarkRequest;
use App\Modules\Inspections\Http\Resources\Tenant\TenantInspectionRemarkResource;
use App\Modules\Inspections\Queries\TenantInspections;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;

final class CreateTenantInspectionRemarkController
{
    public function __invoke(string $inspection, RecordInspectionRemarkRequest $request, TenantInspections $etats, RecordInspectionRemark $action): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $today = CarbonImmutable::today();
        $trouve = $etats->find($user->id, $inspection, $today) ?? throw ErrorCode::InspectionNotFound->problem();

        $resultat = $action->handle(
            $trouve['position'],
            $user,
            $trouve['inspection'],
            RemarkKind::from((string) $request->validated('kind')),
            (string) $request->validated('body'),
            $request->photos(),
            (string) $request->validated('client_id'),
            $today,
        );

        return (new TenantInspectionRemarkResource($resultat['remark']))->response()->setStatusCode($resultat['replayed'] ? 200 : 201);
    }
}
