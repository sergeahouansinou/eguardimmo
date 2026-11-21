<?php

declare(strict_types=1);

namespace App\Modules\Recovery\Http\Controllers\Organization;

use App\Modules\Recovery\Actions\GenerateBundle;
use App\Modules\Recovery\Http\Resources\BundleResource;
use App\Modules\Recovery\Queries\Bundles;
use App\Modules\Recovery\Queries\Cases;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;

final class GenerateBundleController
{
    public function __invoke(string $case, Cases $dossiers, GenerateBundle $generer, Bundles $envois): JsonResponse
    {
        $envoi = $envois->get($generer->handle($dossiers->find($case), CarbonImmutable::today())->id);

        return (new BundleResource($envoi))->response()->setStatusCode(201);
    }
}
