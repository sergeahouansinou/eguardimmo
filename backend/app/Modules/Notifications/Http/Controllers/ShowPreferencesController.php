<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Http\Controllers;

use App\Modules\Notifications\Http\Resources\PreferencesResource;
use App\Modules\Notifications\Queries\EffectivePreferences;
use Illuminate\Http\Request;

final class ShowPreferencesController
{
    public function __invoke(Request $request, EffectivePreferences $preferences): PreferencesResource
    {
        return new PreferencesResource($preferences->matrix((string) $request->user()?->getAuthIdentifier()));
    }
}
