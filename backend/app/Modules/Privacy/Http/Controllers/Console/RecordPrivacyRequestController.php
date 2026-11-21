<?php

declare(strict_types=1);

namespace App\Modules\Privacy\Http\Controllers\Console;

use App\Modules\Identity\Models\User;
use App\Modules\Privacy\Actions\RecordOffAppRequest;
use App\Modules\Privacy\Http\Requests\RecordPrivacyRequestRequest;
use App\Modules\Privacy\Http\Resources\Console\ConsolePrivacyRequestResource;
use App\Modules\Privacy\Queries\ConsoleRequestViews;
use Illuminate\Http\JsonResponse;

final class RecordPrivacyRequestController
{
    public function __invoke(RecordPrivacyRequestRequest $requete, RecordOffAppRequest $saisie, ConsoleRequestViews $vues): JsonResponse
    {
        /** @var User $operateur */
        $operateur = $requete->user();

        $demande = $saisie->handle($operateur, $requete->kind(), $requete->channel(), $requete->requesterEmail(), $requete->receivedAt());

        return (new ConsolePrivacyRequestResource($vues->one($demande, true)))->response()->setStatusCode(201);
    }
}
