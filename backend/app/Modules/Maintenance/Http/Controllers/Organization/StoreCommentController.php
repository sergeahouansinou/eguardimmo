<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Controllers\Organization;

use App\Modules\Maintenance\Actions\AddComment;
use App\Modules\Maintenance\Enums\ActorKind;
use App\Modules\Maintenance\Http\Requests\StoreCommentRequest;
use App\Modules\Maintenance\Http\Resources\EventResource;
use Illuminate\Http\JsonResponse;

final class StoreCommentController
{
    public function __invoke(string $intervention, StoreCommentRequest $request, AddComment $action): JsonResponse
    {
        $evenement = $action->handle($intervention, ActorKind::Team, $request->text(), $request->visibleToTenant(), $request->visibleToOwner());

        return (new EventResource($evenement))->response()->setStatusCode(201);
    }
}
