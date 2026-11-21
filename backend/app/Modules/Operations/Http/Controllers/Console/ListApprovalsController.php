<?php

declare(strict_types=1);

namespace App\Modules\Operations\Http\Controllers\Console;

use App\Modules\Identity\Models\User;
use App\Modules\Operations\Http\Requests\ListApprovalsRequest;
use App\Modules\Operations\Http\Resources\Console\ApprovalResource;
use App\Modules\Operations\Queries\Approvals;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class ListApprovalsController
{
    public function __invoke(ListApprovalsRequest $request, Approvals $demandes): AnonymousResourceCollection
    {
        /** @var User $operateur */
        $operateur = $request->user();
        $roles = $operateur->operatorRoles();
        $page = $demandes->page($roles, $request->status(), $request->action(), $request->mine() ? $operateur->id : null, $request->cursor(), $request->perPage());

        return ApprovalResource::collection($page->items())->additional(['meta' => [
            'has_more' => $page->hasMorePages(),
            'next_cursor' => $page->nextCursor()?->encode(),
            'pending_count' => $demandes->pendingCount($roles),
        ]]);
    }
}
