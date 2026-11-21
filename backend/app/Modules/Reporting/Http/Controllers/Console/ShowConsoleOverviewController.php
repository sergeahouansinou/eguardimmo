<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Http\Controllers\Console;

use App\Modules\Identity\Models\User;
use App\Modules\Reporting\Queries\PlatformOverview;
use App\Modules\Reporting\Support\OverviewSections;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class ShowConsoleOverviewController
{
    public function __invoke(Request $requete, PlatformOverview $accueil): JsonResponse
    {
        $operateur = $requete->user();
        $sections = $operateur instanceof User ? OverviewSections::pour($operateur->operatorRoles()) : [];

        return response()->json(['data' => [
            'generated_at' => now()->toIso8601String(),
            ...$accueil->lire($sections),
        ]]);
    }
}
