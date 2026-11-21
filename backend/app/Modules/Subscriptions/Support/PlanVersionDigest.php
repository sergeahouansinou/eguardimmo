<?php

declare(strict_types=1);

namespace App\Modules\Subscriptions\Support;

use App\Modules\Subscriptions\Models\PlanEntitlement;
use App\Modules\Subscriptions\Models\PlanPrice;
use App\Modules\Subscriptions\Models\PlanVersion;

/**
 * Contenu d'une version de plan (prix, droits, inscription publique) et son empreinte : la double validation d'une publication porte sur
 * cette empreinte, pas sur un identifiant que l'on pourrait modifier après la demande. Montants et droits seulement, aucune donnée personnelle.
 */
final class PlanVersionDigest
{
    /**
     * @return array{public_signup: bool, trial_days: int, prices: array<string, array{monthly: int, yearly: int}>, entitlements: array<string, array{enabled: bool, limit: int|null}>}
     */
    public static function snapshot(PlanVersion $version): array
    {
        $prix = [];

        foreach (PlanPrice::query()->where('plan_version_id', $version->id)->orderBy('currency')->get() as $ligne) {
            $prix[$ligne->currency] = ['monthly' => $ligne->monthly_amount, 'yearly' => $ligne->yearly_amount];
        }

        $droits = [];

        foreach (PlanEntitlement::query()->where('plan_version_id', $version->id)->orderBy('feature_key')->get() as $ligne) {
            $droits[$ligne->feature_key] = ['enabled' => $ligne->enabled, 'limit' => $ligne->limit_value];
        }

        return ['public_signup' => $version->public_signup, 'trial_days' => $version->trial_days, 'prices' => $prix, 'entitlements' => $droits];
    }

    public static function of(PlanVersion $version): string
    {
        return hash('sha256', json_encode(self::snapshot($version), JSON_THROW_ON_ERROR));
    }
}
