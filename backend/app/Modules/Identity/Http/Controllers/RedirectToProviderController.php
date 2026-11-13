<?php

declare(strict_types=1);

namespace App\Modules\Identity\Http\Controllers;

use App\Modules\Identity\Enums\SocialIntentType;
use App\Modules\Identity\Enums\SocialProvider;
use App\Modules\Identity\Http\Requests\SocialRedirectRequest;
use App\Modules\Identity\Social\OAuthState;
use App\Modules\Identity\Social\ProviderGateway;
use App\Modules\Identity\Support\Hub;
use Symfony\Component\HttpFoundation\RedirectResponse;

final class RedirectToProviderController
{
    public function __invoke(SocialRedirectRequest $request, string $provider, ProviderGateway $passerelle): RedirectResponse
    {
        $fournisseur = SocialProvider::from($provider);
        $intention = $request->input('intent') === 'register' ? SocialIntentType::Register : SocialIntentType::Login;

        [$etat, $chiffre, $binder] = OAuthState::issue($fournisseur, $intention, $request->profile(), Hub::safeReturnTo($request->returnTo()), null);

        $reponse = $passerelle->redirect($fournisseur, $chiffre, $etat->nonce, false);
        $reponse->headers->setCookie(OAuthState::binderCookie($binder));
        $reponse->headers->set('Referrer-Policy', 'no-referrer');

        return $reponse;
    }
}
