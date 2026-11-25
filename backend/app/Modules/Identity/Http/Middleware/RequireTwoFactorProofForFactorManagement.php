<?php

declare(strict_types=1);

namespace App\Modules\Identity\Http\Middleware;

use App\Modules\Identity\Enums\ErrorCode;
use App\Modules\Identity\Models\User;
use App\Modules\Identity\Security\PendingTwoFactorSetup;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

final readonly class RequireTwoFactorProofForFactorManagement
{
    private const ROUTE_ACTIVATION = 'two-factor.enable';

    private const ROUTE_DESACTIVATION = 'two-factor.disable';

    private const ROUTE_CONFIRMATION = 'two-factor.confirm';

    public function __construct(private PendingTwoFactorSetup $activation) {}

    /**
     * Une fois la 2FA confirmée, lire ou changer le second facteur exige une preuve 2FA récente, jamais le seul mot de passe (ADR 0032).
     * L'activation initiale reste possible avec le mot de passe confirmé, mais un secret non confirmé n'est lisible et confirmable que par la session qui l'a créé.
     * Un opérateur actif gère son second facteur uniquement sur le serveur. Confirmer un code sur une 2FA déjà confirmée est refusé (409) :
     * Fortify y accepterait un code deviné sans compter les échecs et en tirerait une preuve 2FA.
     *
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();

        if (! $user instanceof User) {
            return $next($request);
        }

        DB::beginTransaction();

        try {
            $this->exiger($request, $user);
            $reponse = $next($request);
        } catch (Throwable $erreur) {
            DB::rollBack();

            throw $erreur;
        }

        $reponse->isServerError() ? DB::rollBack() : DB::commit();

        return $reponse;
    }

    private function exiger(Request $request, User $user): void
    {
        User::query()->whereKey($user->id)->lockForUpdate()->first();
        $user->refresh();

        if ($user->operator()->whereNull('revoked_at')->exists()) {
            throw ErrorCode::OperatorTwoFactorServerOnly->problem();
        }

        if ($user->hasConfirmedTwoFactor()) {
            $this->exigerPreuve($request);
        } else {
            $this->reserverALaSessionDActivation($request, $user);
        }
    }

    private function exigerPreuve(Request $request): void
    {
        if ($request->boolean('force') || $request->route()?->getName() === self::ROUTE_CONFIRMATION) {
            throw ErrorCode::TwoFactorAlreadyEnabled->problem();
        }

        if (! EnsureRecentReauthentication::confirmedRecently($request, EnsureRecentReauthentication::CLE_2FA)) {
            throw ErrorCode::ReauthenticationRequired->problem();
        }
    }

    private function reserverALaSessionDActivation(Request $request, User $user): void
    {
        $route = $request->route()?->getName();

        if ($route === self::ROUTE_DESACTIVATION || $this->activation->ownedBy($request->session(), $user)) {
            return;
        }

        if ($route === self::ROUTE_ACTIVATION) {
            $request->merge(['force' => true]);

            return;
        }

        if ($user->two_factor_secret !== null || $route === self::ROUTE_CONFIRMATION) {
            throw ErrorCode::TwoFactorSetupExpired->problem();
        }
    }
}
