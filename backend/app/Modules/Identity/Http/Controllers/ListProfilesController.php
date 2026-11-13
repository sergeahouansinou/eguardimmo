<?php

declare(strict_types=1);

namespace App\Modules\Identity\Http\Controllers;

use App\Modules\Identity\Http\Resources\ProfileResource;
use App\Modules\Identity\Models\User;
use App\Modules\Identity\PublicApi\ProfileRegistry;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class ListProfilesController
{
    public function __invoke(Request $request, ProfileRegistry $profils): AnonymousResourceCollection
    {
        /** @var User $user */
        $user = $request->user();

        return ProfileResource::collection($profils->profilesFor($user->id));
    }
}
