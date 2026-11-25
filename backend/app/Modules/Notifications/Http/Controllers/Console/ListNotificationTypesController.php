<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Http\Controllers\Console;

use App\Modules\Notifications\Http\Resources\Console\PlatformNotificationTypeResource;
use App\Modules\Notifications\Queries\PlatformNotificationTypes;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class ListNotificationTypesController
{
    public function __invoke(PlatformNotificationTypes $types): AnonymousResourceCollection
    {
        return PlatformNotificationTypeResource::collection($types->all());
    }
}
