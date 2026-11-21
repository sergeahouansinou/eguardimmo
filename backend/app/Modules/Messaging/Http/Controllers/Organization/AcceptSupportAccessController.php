<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Controllers\Organization;

use App\Modules\Identity\Models\User;
use App\Modules\Identity\PublicApi\TwoFactorProofs;
use App\Modules\Messaging\Actions\AcceptSupportAccess;
use App\Modules\Messaging\Http\Requests\AcceptSupportAccessRequest;
use App\Modules\Messaging\Http\Resources\Organization\SupportAccessResource;
use App\Modules\Messaging\Queries\SupportAccessGrants;
use App\Modules\Messaging\Support\SupportAccessAdministrators;
use App\Shared\Tenancy\CurrentOrganization;

/**
 * Consentement de l'organisation : `owner` ou `admin`, avec la 2FA et une preuve récente (routes).
 */
final class AcceptSupportAccessController
{
    public function __invoke(AcceptSupportAccessRequest $request, string $grant, SupportAccessGrants $acces, SupportAccessAdministrators $administrateurs, AcceptSupportAccess $decision, TwoFactorProofs $preuves, CurrentOrganization $organisation): SupportAccessResource
    {
        /** @var User $user */
        $user = $request->user();
        $administrateurs->assert($user);
        $demande = $acces->find($organisation->id(), $grant);
        $decision->handle($demande, $user, $request->hours(), $request->scopes(), $preuves->recent($request));

        return new SupportAccessResource($acces->find($organisation->id(), $grant));
    }
}
