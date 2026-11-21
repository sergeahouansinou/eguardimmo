<?php

declare(strict_types=1);

namespace App\Modules\Parties\Http\Controllers\Organization;

use App\Modules\Identity\Models\User;
use App\Modules\Parties\Actions\ApplyContactUpdate;
use App\Modules\Parties\Http\Resources\ContactUpdateResource;
use App\Modules\Parties\Queries\ContactUpdates;
use App\Modules\Parties\Queries\Parties;
use Illuminate\Http\Request;

final class ApplyContactUpdateController
{
    public function __invoke(string $party, string $contactUpdate, Request $request, Parties $parties, ContactUpdates $demandes, ApplyContactUpdate $action): ContactUpdateResource
    {
        /** @var User $user */
        $user = $request->user();
        $partie = $parties->get($party);

        return new ContactUpdateResource($action->handle($partie, $demandes->get($partie->id, $contactUpdate), $user));
    }
}
