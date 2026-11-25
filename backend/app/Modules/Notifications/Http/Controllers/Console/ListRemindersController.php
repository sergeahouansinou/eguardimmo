<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Http\Controllers\Console;

use App\Modules\Notifications\Http\Resources\Console\ReminderResource;
use App\Modules\Notifications\Queries\ReminderRules;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class ListRemindersController
{
    public function __invoke(ReminderRules $reglages): AnonymousResourceCollection
    {
        return ReminderResource::collection($reglages->all());
    }
}
