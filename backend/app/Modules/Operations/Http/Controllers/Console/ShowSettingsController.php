<?php

declare(strict_types=1);

namespace App\Modules\Operations\Http\Controllers\Console;

use App\Modules\Operations\Support\EffectiveSettings;
use Illuminate\Http\JsonResponse;

final class ShowSettingsController
{
    public function __invoke(EffectiveSettings $reglages): JsonResponse
    {
        return response()->json(['data' => $reglages->all()]);
    }
}
