<?php

declare(strict_types=1);

namespace App\Modules\Identity\Http\Controllers;

use App\Modules\Identity\Http\Resources\SecurityResource;
use App\Modules\Identity\Models\User;
use App\Modules\Identity\Queries\MobileDevices;
use Illuminate\Http\Request;

final class ShowSecurityController
{
    public function __invoke(Request $request, MobileDevices $appareils): SecurityResource
    {
        /** @var User $user */
        $user = $request->user();

        return new SecurityResource($user->load('socialIdentities'), $appareils->for($user));
    }
}
