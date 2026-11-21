<?php

declare(strict_types=1);

namespace App\Modules\Operations\Http\Controllers\Console;

use App\Modules\Identity\Models\User;
use App\Modules\Operations\Actions\ApproveApproval;
use App\Modules\Operations\Http\Resources\Console\ApprovalResource;
use App\Modules\Operations\Queries\Approvals;
use App\Shared\Http\OperatorProof;
use Illuminate\Http\Request;

final class ApproveApprovalController
{
    public function __invoke(Request $request, string $approval, Approvals $demandes, ApproveApproval $action): ApprovalResource
    {
        /** @var User $operateur */
        $operateur = $request->user();
        $demande = $demandes->find($operateur->operatorRoles(), $approval);

        return new ApprovalResource($action->handle($demande, $operateur, OperatorProof::kind($request)));
    }
}
