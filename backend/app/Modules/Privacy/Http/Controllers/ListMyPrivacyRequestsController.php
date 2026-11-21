<?php

declare(strict_types=1);

namespace App\Modules\Privacy\Http\Controllers;

use App\Modules\Identity\Models\User;
use App\Modules\Privacy\Http\Resources\PrivacyRequestResource;
use App\Modules\Privacy\Queries\PrivacyRequests;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class ListMyPrivacyRequestsController
{
    public function __invoke(Request $requete, PrivacyRequests $demandes): AnonymousResourceCollection
    {
        /** @var User $user */
        $user = $requete->user();

        return PrivacyRequestResource::collection($demandes->ownedBy($user->id));
    }
}
