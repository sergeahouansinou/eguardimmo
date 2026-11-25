<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Http\Controllers\Console;

use App\Modules\Notifications\Actions\SaveReminderRule;
use App\Modules\Notifications\Http\Requests\Console\SaveReminderRequest;
use App\Modules\Notifications\Http\Resources\Console\ReminderResource;
use App\Modules\Notifications\Queries\ReminderRules;

final class SaveReminderController
{
    public function __invoke(SaveReminderRequest $requete, SaveReminderRule $action, ReminderRules $reglages): ReminderResource
    {
        $reglage = $requete->toData();
        $action->handle($reglage, (string) $requete->user()?->getAuthIdentifier());

        return new ReminderResource($reglages->for($reglage->code));
    }
}
