<?php

declare(strict_types=1);

namespace App\Modules\Identity\Http\Controllers;

use App\Modules\Identity\Actions\ResolveSocialLogin;
use App\Modules\Identity\Data\SocialIntent;
use App\Modules\Identity\Enums\ErrorCode;
use App\Modules\Identity\Enums\SocialIntentType;
use App\Modules\Identity\Enums\SocialProvider;
use App\Modules\Identity\Models\User;
use App\Modules\Identity\Social\OAuthState;
use App\Modules\Identity\Social\ProviderGateway;
use App\Modules\Identity\Support\Hub;
use App\Shared\Http\ApiProblem;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\RedirectResponse;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

final class HandleProviderCallbackController
{
    public function __invoke(Request $request, string $provider, ProviderGateway $passerelle, ResolveSocialLogin $resolution): Response
    {
        $fournisseur = SocialProvider::from($provider);
        $etat = OAuthState::consume($request, $fournisseur);

        if ($etat === null || ($etat->intent === SocialIntentType::Link && Auth::guard('web')->id() !== $etat->userId)) {
            return $this->versHub(ErrorCode::InvalidState->value, Hub::url());
        }

        try {
            [$profil, $jetonApple] = $passerelle->user($fournisseur, $etat->nonce);
        } catch (Throwable $e) {
            report($e);

            return $this->versHub(ErrorCode::ProviderError->value, $etat->returnTo);
        }

        try {
            $user = $resolution->handle($profil, $this->intention($etat));
        } catch (ApiProblem $refus) {
            return $this->versHub($refus->problemCode, $etat->returnTo);
        }

        if ($jetonApple !== null) {
            $user->storeAppleRefreshToken($jetonApple, (string) config('services.apple.client_id'));
        }

        return $this->finaliser($this->ouvrirSession($request, $user, $etat));
    }

    private function ouvrirSession(Request $request, User $user, OAuthState $etat): RedirectResponse
    {
        if ($etat->intent === SocialIntentType::Link) {
            return new RedirectResponse($etat->returnTo, 303);
        }

        if ($user->hasConfirmedTwoFactor()) {
            $request->session()->regenerate();
            $request->session()->put(['login.id' => $user->id, 'login.remember' => false]);

            return new RedirectResponse(Hub::url('/connexion/verification').'?'.http_build_query(['return_to' => $etat->returnTo]), 303);
        }

        Auth::guard('web')->login($user);
        $request->session()->regenerate();

        return new RedirectResponse($etat->returnTo, 303);
    }

    private function intention(OAuthState $etat): SocialIntent
    {
        return match ($etat->intent) {
            SocialIntentType::Link => SocialIntent::link((string) $etat->userId),
            SocialIntentType::Register => $etat->profile !== null ? SocialIntent::register($etat->profile) : SocialIntent::login(),
            SocialIntentType::Login => SocialIntent::login(),
        };
    }

    private function versHub(string $code, string $retour): Response
    {
        return $this->finaliser(new RedirectResponse(Hub::url('/connexion').'?'.http_build_query(['erreur' => $code, 'return_to' => $retour]), 303));
    }

    private function finaliser(Response $reponse): Response
    {
        $reponse->headers->set('Referrer-Policy', 'no-referrer');
        $reponse->headers->setCookie(OAuthState::forgetBinderCookie());

        return $reponse;
    }
}
