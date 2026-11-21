<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Http\Middleware;

use App\Modules\Identity\Models\User;
use App\Modules\Messaging\Enums\ErrorCode;
use App\Modules\Messaging\Enums\SupportAccessScope;
use App\Modules\Messaging\Support\SupportAccessGate;
use Closure;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Http\Request;
use Illuminate\Routing\Route;
use Illuminate\Support\Str;
use LogicException;
use Symfony\Component\HttpFoundation\Response;

/**
 * `support-access:{périmètre}` sur toute route de la console qui lit les données d'une organisation (ADR 0033, décision 9) : l'organisation
 * est le paramètre `{organization}` de la route. Sans accès vivant pour ce périmètre : 403 `support_access_required`, que l'organisation
 * existe ou non.
 */
final readonly class EnsureSupportAccess
{
    public function __construct(private SupportAccessGate $garde) {}

    /**
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next, string $perimetre): Response
    {
        $user = $request->user();

        if (! $user instanceof User) {
            throw new AuthenticationException;
        }

        $cible = SupportAccessScope::tryFrom($perimetre) ?? throw new LogicException("Périmètre d'accès du support inconnu : {$perimetre}.");
        $route = $request->route();
        $organisation = $route instanceof Route ? $route->parameter('organization') : null;

        if (! is_string($organisation) || ! Str::isUuid($organisation)) {
            throw ErrorCode::SupportAccessRequired->problem();
        }

        $organisation = strtolower($organisation);
        $acces = $this->garde->live($user->id, $organisation, $cible);

        if ($acces === null) {
            $this->garde->denied($user->id, $organisation, $cible, $request);

            throw ErrorCode::SupportAccessRequired->problem();
        }

        $reponse = $next($request);

        if ($reponse->isSuccessful()) {
            $this->garde->recordRead($acces, $cible, $request);
        }

        return $reponse;
    }
}
