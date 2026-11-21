<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Http\Controllers;

use App\Modules\Notifications\Actions\SavePreferences;
use App\Modules\Notifications\Http\Requests\SavePreferencesRequest;
use App\Modules\Notifications\Http\Resources\PreferencesResource;
use App\Modules\Notifications\Queries\EffectivePreferences;

final class SavePreferencesController
{
    public function __invoke(SavePreferencesRequest $request, SavePreferences $enregistrement, EffectivePreferences $preferences): PreferencesResource
    {
        $compte = (string) $request->user()?->getAuthIdentifier();
        $enregistrement->handle($compte, $request->toData());

        return new PreferencesResource($preferences->matrix($compte));
    }
}
