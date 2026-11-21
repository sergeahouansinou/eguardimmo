<?php

declare(strict_types=1);

namespace App\Modules\Leases\Http\Controllers\Organization;

use App\Modules\Identity\Models\User;
use App\Modules\Leases\Actions\ShareLeaseDocument;
use App\Modules\Leases\Http\Requests\ShareLeaseDocumentRequest;
use App\Modules\Leases\Http\Resources\LeaseDocumentResource;
use App\Modules\Leases\Queries\Leases;
use Illuminate\Http\JsonResponse;

final class ShareLeaseDocumentController
{
    public function __invoke(string $lease, ShareLeaseDocumentRequest $request, Leases $baux, ShareLeaseDocument $action): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $document = $action->handle($baux->get($lease), $user, (string) $request->validated('stored_file_id'), $request->kind(), $request->partyId());

        return (new LeaseDocumentResource($document))->response()->setStatusCode(201);
    }
}
