<?php

declare(strict_types=1);

namespace App\Modules\Identity\Http\Controllers;

use App\Modules\Identity\Actions\LoginWithIdentityToken;
use App\Modules\Identity\Enums\SocialProvider;
use App\Modules\Identity\Http\Requests\SocialTokenRequest;
use App\Modules\Identity\Http\Resources\MobileLoginResource;
use Illuminate\Http\JsonResponse;

final class IssueSocialMobileTokenController
{
    public function __invoke(SocialTokenRequest $request, string $provider, LoginWithIdentityToken $connexion): JsonResponse
    {
        $fournisseur = SocialProvider::from($provider);

        return (new MobileLoginResource($connexion->handle(
            $fournisseur,
            (string) $request->string('id_token'),
            (string) $request->string('nonce'),
            $fournisseur === SocialProvider::Apple ? $request->authorizationCode() : null,
            $request->intent(),
            (string) $request->string('device_name'),
            $request->fullName(),
        )))->response()->setStatusCode(201);
    }
}
