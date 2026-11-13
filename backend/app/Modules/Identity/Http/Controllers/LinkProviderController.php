<?php

declare(strict_types=1);

namespace App\Modules\Identity\Http\Controllers;

use App\Modules\Identity\Enums\SocialIntentType;
use App\Modules\Identity\Enums\SocialProvider;
use App\Modules\Identity\Http\Requests\SocialLinkRequest;
use App\Modules\Identity\Models\User;
use App\Modules\Identity\Social\OAuthState;
use App\Modules\Identity\Social\ProviderGateway;
use App\Modules\Identity\Support\Hub;
use Illuminate\Http\JsonResponse;

final class LinkProviderController
{
    public function __invoke(SocialLinkRequest $request, string $provider, ProviderGateway $passerelle): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $fournisseur = SocialProvider::from($provider);

        [$etat, $chiffre, $binder] = OAuthState::issue($fournisseur, SocialIntentType::Link, null, Hub::safeReturnTo($request->returnTo()), $user->id);

        $url = $passerelle->redirect($fournisseur, $chiffre, $etat->nonce, true)->getTargetUrl();

        $reponse = new JsonResponse(['data' => ['url' => $url]]);
        $reponse->headers->setCookie(OAuthState::binderCookie($binder));

        return $reponse;
    }
}
