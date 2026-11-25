<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Controllers\Organization;

use App\Modules\Maintenance\Actions\AddComment;
use App\Modules\Maintenance\Enums\ActorKind;
use App\Modules\Maintenance\Http\Requests\StoreCommentRequest;
use App\Modules\Maintenance\Http\Resources\EventResource;
use App\Modules\Maintenance\Http\Support\IdempotencyHeader;
use Illuminate\Http\JsonResponse;

final class StoreCommentController
{
    public function __invoke(string $intervention, StoreCommentRequest $request, AddComment $action): JsonResponse
    {
        $cle = IdempotencyHeader::readOptional($request);
        $resultat = $action->handle($intervention, ActorKind::Team, $request->text(), $request->visibleToTenant(), $request->visibleToOwner(), $cle);

        return (new EventResource($resultat['event']))->response()->setStatusCode($resultat['replayed'] ? 200 : 201);
    }
}
