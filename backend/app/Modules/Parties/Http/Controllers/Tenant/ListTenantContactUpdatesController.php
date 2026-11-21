<?php

declare(strict_types=1);

namespace App\Modules\Parties\Http\Controllers\Tenant;

use App\Modules\Identity\Models\User;
use App\Modules\Parties\Http\Requests\ListCursorRequest;
use App\Modules\Parties\Http\Resources\Tenant\TenantContactUpdateResource;
use App\Modules\Parties\Queries\ContactUpdates;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class ListTenantContactUpdatesController
{
    public function __invoke(ListCursorRequest $request, ContactUpdates $demandes): AnonymousResourceCollection
    {
        /** @var User $user */
        $user = $request->user();

        return TenantContactUpdateResource::collection($demandes->ofAccount($user->id, $request->perPage(), $request->cursor()));
    }
}
