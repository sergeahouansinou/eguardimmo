<?php

declare(strict_types=1);

namespace App\Modules\Operations\Http\Controllers\Console;

use App\Modules\Operations\Support\PlatformHealth;
use Illuminate\Http\JsonResponse;

final class ShowHealthController
{
    public function __invoke(): JsonResponse
    {
        return response()->json(['data' => [
            ...PlatformHealth::make()->report(),
            'links' => [
                'monitoring_url' => self::lien('operations.monitoring_url'),
                'status_page_url' => self::lien('operations.status_page_url'),
            ],
        ]]);
    }

    private static function lien(string $cle): ?string
    {
        $valeur = config($cle);

        return is_string($valeur) && $valeur !== '' ? $valeur : null;
    }
}
