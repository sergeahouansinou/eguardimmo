<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Controllers\Organization;

use App\Modules\Maintenance\Actions\WithdrawApproval;
use App\Modules\Maintenance\Http\Resources\ApprovalResource;

final class WithdrawApprovalController
{
    public function __invoke(string $intervention, string $approval, WithdrawApproval $action): ApprovalResource
    {
        return new ApprovalResource($action->handle($intervention, $approval));
    }
}
