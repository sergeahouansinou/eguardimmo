<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Http\Controllers\Console;

use App\Modules\Notifications\Actions\SaveNotificationTypes;
use App\Modules\Notifications\Http\Requests\Console\SaveNotificationTypesRequest;
use App\Modules\Notifications\Http\Resources\Console\PlatformNotificationTypeResource;
use App\Modules\Notifications\Queries\PlatformNotificationTypes;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class SaveNotificationTypesController
{
    public function __invoke(SaveNotificationTypesRequest $requete, SaveNotificationTypes $action, PlatformNotificationTypes $types): AnonymousResourceCollection
    {
        $action->handle($requete->toData(), (string) $requete->user()?->getAuthIdentifier());

        return PlatformNotificationTypeResource::collection($types->all());
    }
}
