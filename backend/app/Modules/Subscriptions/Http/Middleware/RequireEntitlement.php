<?php

declare(strict_types=1);

namespace App\Modules\Subscriptions\Http\Middleware;

use App\Modules\Subscriptions\Enums\Feature;
use App\Modules\Subscriptions\PublicApi\Entitlements;
use App\Shared\Tenancy\CurrentOrganization;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * `entitled:{fonction}` : à placer après `organization`. Lecture et export ne sont jamais bloqués (ADR 0013).
 */
final readonly class RequireEntitlement
{
    public function __construct(private Entitlements $droits, private CurrentOrganization $contexte) {}

    /**
     * @param  Closure(Request): Response  $next
     */
    public function handle(Request $request, Closure $next, string $fonction): Response
    {
        if (! $request->isMethodSafe()) {
            $this->droits->assertEnabled($this->contexte->id(), Feature::from($fonction));
        }

        return $next($request);
    }
}
