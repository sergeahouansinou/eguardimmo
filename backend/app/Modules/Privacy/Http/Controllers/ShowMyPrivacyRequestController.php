<?php

declare(strict_types=1);

namespace App\Modules\Privacy\Http\Controllers;

use App\Modules\Identity\Models\User;
use App\Modules\Privacy\Http\Resources\PrivacyRequestResource;
use App\Modules\Privacy\Queries\PrivacyRequests;
use Illuminate\Http\Request;

final class ShowMyPrivacyRequestController
{
    public function __invoke(Request $requete, string $privacyRequest, PrivacyRequests $demandes): PrivacyRequestResource
    {
        /** @var User $user */
        $user = $requete->user();

        return new PrivacyRequestResource($demandes->findOwned($user->id, $privacyRequest));
    }
}
