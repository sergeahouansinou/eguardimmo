<?php

declare(strict_types=1);

namespace App\Modules\Inspections\Http\Controllers\Organization;

use App\Modules\Identity\Models\User;
use App\Modules\Inspections\Actions\AnswerInspectionRemark;
use App\Modules\Inspections\Http\Requests\AnswerInspectionRemarkRequest;
use App\Modules\Inspections\Http\Resources\InspectionRemarkResource;
use App\Modules\Inspections\Queries\Inspections;

final class AnswerInspectionRemarkController
{
    public function __invoke(string $remark, AnswerInspectionRemarkRequest $request, Inspections $etats, AnswerInspectionRemark $action): InspectionRemarkResource
    {
        /** @var User $user */
        $user = $request->user();

        return new InspectionRemarkResource($action->handle($etats->remark($remark), $user, $request->decision(), $request->text()));
    }
}
