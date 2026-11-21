<?php

declare(strict_types=1);

namespace App\Modules\Mandates\Http\Controllers\Organization;

use App\Modules\Mandates\Http\Resources\MandateEndRequestResource;
use App\Modules\Mandates\Queries\MandateEndRequests;
use App\Modules\Mandates\Queries\Mandates;
use Illuminate\Http\JsonResponse;

final class ShowMandateEndRequestController
{
    /**
     * `data` vaut null quand aucune demande ne vit : la lecture d'un état n'est pas une erreur.
     */
    public function __invoke(string $mandate, Mandates $mandats, MandateEndRequests $demandes): JsonResponse
    {
        $demande = $demandes->pendingOf($mandats->get($mandate)->id);

        return new JsonResponse(['data' => $demande === null ? null : (new MandateEndRequestResource($demande))->resolve()]);
    }
}
