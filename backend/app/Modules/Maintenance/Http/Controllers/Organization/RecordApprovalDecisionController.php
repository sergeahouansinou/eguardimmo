<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Controllers\Organization;

use App\Modules\Maintenance\Actions\RecordApprovalDecision;
use App\Modules\Maintenance\Http\Requests\ApprovalDecisionRequest;
use App\Modules\Maintenance\Http\Resources\ApprovalResource;

final class RecordApprovalDecisionController
{
    public function __invoke(string $intervention, string $approval, ApprovalDecisionRequest $request, RecordApprovalDecision $action): ApprovalResource
    {
        $resultat = $action->handle($intervention, $approval, $request->toData());

        return new ApprovalResource($resultat['approval'], $resultat['replayed']);
    }
}
