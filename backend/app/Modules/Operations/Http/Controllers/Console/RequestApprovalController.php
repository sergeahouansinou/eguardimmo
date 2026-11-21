<?php

declare(strict_types=1);

namespace App\Modules\Operations\Http\Controllers\Console;

use App\Modules\Identity\Models\User;
use App\Modules\Operations\Actions\RequestApproval;
use App\Modules\Operations\Http\Requests\StoreApprovalRequest;
use App\Modules\Operations\Http\Resources\Console\ApprovalResource;
use App\Shared\Http\OperatorProof;
use Illuminate\Http\JsonResponse;

final class RequestApprovalController
{
    public function __invoke(StoreApprovalRequest $request, RequestApproval $demande): JsonResponse
    {
        /** @var User $demandeur */
        $demandeur = $request->user();

        $approbation = $demande->handle(
            $demandeur,
            $request->approvalAction(),
            (string) $request->string('subject_id'),
            $request->payload(),
            (string) $request->string('reason'),
            $request->filled('ticket_reference') ? (string) $request->string('ticket_reference') : null,
            OperatorProof::kind($request),
        );

        return (new ApprovalResource($approbation))->response()->setStatusCode(201);
    }
}
