<?php

declare(strict_types=1);

namespace App\Modules\Parties\Http\Controllers\Organization;

use App\Modules\Identity\Models\User;
use App\Modules\Parties\Actions\DismissContactUpdate;
use App\Modules\Parties\Http\Resources\ContactUpdateResource;
use App\Modules\Parties\Queries\ContactUpdates;
use App\Modules\Parties\Queries\Parties;
use Illuminate\Http\Request;

final class DismissContactUpdateController
{
    public function __invoke(string $party, string $contactUpdate, Request $request, Parties $parties, ContactUpdates $demandes, DismissContactUpdate $action): ContactUpdateResource
    {
        /** @var User $user */
        $user = $request->user();

        return new ContactUpdateResource($action->handle($demandes->get($parties->get($party)->id, $contactUpdate), $user));
    }
}
