<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Controllers\Organization;

use App\Modules\Identity\Models\User;
use App\Modules\Messaging\Http\Requests\ListSupportAccessRequest;
use App\Modules\Messaging\Http\Resources\Organization\SupportAccessResource;
use App\Modules\Messaging\Queries\SupportAccessGrants;
use App\Modules\Messaging\Support\SupportAccessAdministrators;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class ListSupportAccessController
{
    public function __invoke(ListSupportAccessRequest $request, SupportAccessGrants $acces, SupportAccessAdministrators $administrateurs, CurrentOrganization $organisation): AnonymousResourceCollection
    {
        /** @var User $user */
        $user = $request->user();
        $administrateurs->assert($user);
        $page = $acces->page($organisation->id(), $request->status(), $request->cursor(), $request->perPage());

        return SupportAccessResource::collection($page->items())->additional(['meta' => [
            'has_more' => $page->hasMorePages(),
            'next_cursor' => $page->nextCursor()?->encode(),
        ]]);
    }
}
