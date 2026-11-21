<?php

declare(strict_types=1);

namespace App\Modules\Privacy\Http\Controllers;

use App\Modules\Identity\Models\User;
use App\Modules\Identity\PublicApi\AccountOwnership;
use App\Modules\Privacy\Actions\ReceiveAccountRequest;
use App\Modules\Privacy\Http\Requests\StorePrivacyRequestRequest;
use App\Modules\Privacy\Http\Resources\PrivacyRequestResource;
use Illuminate\Http\JsonResponse;

final class StorePrivacyRequestController
{
    public function __invoke(StorePrivacyRequestRequest $requete, ReceiveAccountRequest $reception, AccountOwnership $detention): JsonResponse
    {
        /** @var User $user */
        $user = $requete->user();

        if ($requete->kind()->requiresReauthentication()) {
            $detention->confirm($user->id, $requete);
        }

        return (new PrivacyRequestResource($reception->handle($user, $requete->kind())))->response()->setStatusCode(201);
    }
}
