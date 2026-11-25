<?php

declare(strict_types=1);

namespace App\Modules\Subscriptions\PublicApi;

use App\Modules\Subscriptions\Data\EntitlementData;
use App\Modules\Subscriptions\Enums\ErrorCode;
use App\Modules\Subscriptions\Enums\Feature;
use App\Modules\Subscriptions\Queries\EffectiveEntitlements;
use App\Modules\Subscriptions\Queries\Plans;
use Closure;

/**
 * Droits d'une organisation. Subscriptions n'appelle aucun module : l'appelant compte ses objets, sous son propre verrou, et passe le
 * nombre actuel. Une organisation sans abonnement (créée avant le module) n'est limitée par rien : `subscriptions:verify` la rattrape.
 */
final readonly class Entitlements
{
    public function __construct(private EffectiveEntitlements $droits, private Plans $plans) {}

    /**
     * @return array<string, EntitlementData>|null
     */
    public function effective(string $organizationId): ?array
    {
        return $this->droits->of($organizationId);
    }

    public function assertEnabled(string $organizationId, Feature $fonction): void
    {
        $droit = $this->droits->of($organizationId)[$fonction->value] ?? null;

        if ($droit !== null && ! $droit->enabled) {
            throw ErrorCode::FeatureNotInPlan->problem(extensions: ['feature' => $fonction->value]);
        }
    }

    /**
     * `$nombreActuel` et `$ajout` s'expriment dans l'unité de la fonction (`Feature::unit()` : l'octet pour le stockage, dont la limite se compte en Mo).
     *
     * @param  int|Closure(): int  $nombreActuel  une fermeture est évaluée après le verrou de l'abonnement : deux créations concurrentes ne passent pas ensemble la limite
     * @param  int|Closure(): int  $ajout  une fermeture est évaluée après le verrou, avant `$nombreActuel` ; un ajout nul ou négatif n'est jamais refusé
     */
    public function assertWithin(string $organizationId, Feature $fonction, int|Closure $nombreActuel, int|Closure $ajout = 1): void
    {
        $droit = $this->droits->of($organizationId, $nombreActuel instanceof Closure || $ajout instanceof Closure)[$fonction->value] ?? null;

        if ($droit === null) {
            return;
        }

        if ($ajout instanceof Closure) {
            $ajout = $ajout();

            if ($ajout <= 0) {
                return;
            }
        }

        if (! $droit->enabled) {
            throw ErrorCode::FeatureNotInPlan->problem(extensions: ['feature' => $fonction->value]);
        }

        $nombreActuel = $nombreActuel instanceof Closure ? $nombreActuel() : $nombreActuel;
        $unite = $fonction->unit();

        if ($droit->limit !== null && $nombreActuel + $ajout > $droit->limit * $unite) {
            $plan = $this->plans->sufficientFor($fonction, intdiv($nombreActuel + $ajout + $unite - 1, $unite));

            throw ErrorCode::PlanQuotaReached->problem(
                ErrorCode::PlanQuotaReached->detail().($plan === null ? '' : " Le plan {$plan} couvre ce besoin."),
                ['feature' => $fonction->value, 'limit' => $droit->limit, 'current' => intdiv($nombreActuel + $unite - 1, $unite)],
            );
        }
    }
}
