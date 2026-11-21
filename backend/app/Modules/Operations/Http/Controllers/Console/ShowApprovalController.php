<?php

declare(strict_types=1);

namespace App\Modules\Operations\Http\Controllers\Console;

use App\Modules\Identity\Models\User;
use App\Modules\Operations\Http\Resources\Console\ApprovalResource;
use App\Modules\Operations\Queries\Approvals;
use Illuminate\Http\Request;

final class ShowApprovalController
{
    public function __invoke(Request $request, string $approval, Approvals $demandes): ApprovalResource
    {
        /** @var User $operateur */
        $operateur = $request->user();

        return new ApprovalResource($demandes->find($operateur->operatorRoles(), $approval));
    }
}
