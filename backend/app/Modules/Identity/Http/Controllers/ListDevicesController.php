<?php

declare(strict_types=1);

namespace App\Modules\Identity\Http\Controllers;

use App\Modules\Identity\Http\Resources\DeviceResource;
use App\Modules\Identity\Models\User;
use App\Modules\Identity\Queries\MobileDevices;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class ListDevicesController
{
    public function __invoke(Request $request, MobileDevices $appareils): AnonymousResourceCollection
    {
        /** @var User $user */
        $user = $request->user();

        return DeviceResource::collection($appareils->for($user));
    }
}
