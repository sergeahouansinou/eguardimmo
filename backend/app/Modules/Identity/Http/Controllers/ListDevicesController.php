<?php

declare(strict_types=1);

namespace App\Modules\Identity\Http\Controllers;

use App\Modules\Identity\Actions\IssueMobileToken;
use App\Modules\Identity\Http\Resources\DeviceResource;
use App\Modules\Identity\Models\User;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class ListDevicesController
{
    public function __invoke(Request $request): AnonymousResourceCollection
    {
        /** @var User $user */
        $user = $request->user();

        $jetons = $user->tokens()
            ->where('abilities', 'like', '%"'.IssueMobileToken::CAPACITE.'"%')
            ->latest('id')
            ->get();

        return DeviceResource::collection($jetons);
    }
}
