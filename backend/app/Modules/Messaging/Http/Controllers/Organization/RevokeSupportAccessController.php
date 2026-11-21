<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Controllers\Organization;

use App\Modules\Identity\Models\User;
use App\Modules\Messaging\Actions\RevokeSupportAccess;
use App\Modules\Messaging\Http\Resources\Organization\SupportAccessResource;
use App\Modules\Messaging\Queries\SupportAccessGrants;
use App\Modules\Messaging\Support\SupportAccessAdministrators;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Http\Request;

final class RevokeSupportAccessController
{
    public function __invoke(Request $request, string $grant, SupportAccessGrants $acces, SupportAccessAdministrators $administrateurs, RevokeSupportAccess $revocation, CurrentOrganization $organisation): SupportAccessResource
    {
        /** @var User $user */
        $user = $request->user();
        $administrateurs->assert($user);
        $revocation->handle($acces->find($organisation->id(), $grant), $user);

        return new SupportAccessResource($acces->find($organisation->id(), $grant));
    }
}
