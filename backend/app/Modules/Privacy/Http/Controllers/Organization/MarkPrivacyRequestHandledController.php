<?php

declare(strict_types=1);

namespace App\Modules\Privacy\Http\Controllers\Organization;

use App\Modules\Identity\Models\User;
use App\Modules\Privacy\Actions\MarkForwardHandled;
use App\Modules\Privacy\Http\Resources\OrganizationPrivacyRequestResource;
use App\Modules\Privacy\Queries\RequestForwards;
use App\Modules\Privacy\Support\OrganizationPrivacyAdministrators;
use Illuminate\Http\Request;

final class MarkPrivacyRequestHandledController
{
    public function __invoke(Request $requete, string $forward, RequestForwards $transmissions, OrganizationPrivacyAdministrators $administrateurs, MarkForwardHandled $traitement): OrganizationPrivacyRequestResource
    {
        /** @var User $user */
        $user = $requete->user();
        $administrateurs->assert($user);
        $transmissions->findInCurrentOrganization($forward);

        return new OrganizationPrivacyRequestResource($traitement->handle($forward, $user)->load('privacyRequest'));
    }
}
