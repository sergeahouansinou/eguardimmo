<?php

declare(strict_types=1);

namespace App\Modules\Subscriptions\Support;

use App\Modules\Subscriptions\Enums\Feature;
use App\Modules\Subscriptions\Enums\PlanVersionStatus;
use App\Modules\Subscriptions\Models\Plan;
use App\Modules\Subscriptions\Models\PlanEntitlement;
use App\Modules\Subscriptions\Models\PlanPrice;
use App\Modules\Subscriptions\Models\PlanVersion;
use Illuminate\Support\Facades\DB;

/**
 * Grille de l'ADR 0013 (prix HT en centimes, EUR puis CAD). Un plan déjà présent n'est jamais retouché : toute révision passe par une version.
 */
final class PlanGrid
{
    private const NON_LIMITE = null;

    /**
     * @return array<string, array{name: string, prices: array<string, array{int, int}>, limits: array<string, int|null>}>
     */
    public static function definition(): array
    {
        return [
            'free' => ['name' => 'Gratuit', 'prices' => ['EUR' => [0, 0], 'CAD' => [0, 0]], 'limits' => [
                Feature::Properties->value => 1, Feature::Tenants->value => 2, Feature::Leases->value => 2, Feature::Inspections->value => 4,
                Feature::Storage->value => 50, Feature::Users->value => 1, Feature::Signatures->value => 0,
            ]],
            'silver' => ['name' => 'Silver', 'prices' => ['EUR' => [490, 5800], 'CAD' => [844, 9340]], 'limits' => [
                Feature::Properties->value => 5, Feature::Tenants->value => self::NON_LIMITE, Feature::Leases->value => self::NON_LIMITE, Feature::Inspections->value => self::NON_LIMITE,
                Feature::Storage->value => 500, Feature::Users->value => self::NON_LIMITE, Feature::Signatures->value => 10,
            ]],
            'gold' => ['name' => 'Gold', 'prices' => ['EUR' => [1090, 11800], 'CAD' => [1804, 18940]], 'limits' => [
                Feature::Properties->value => self::NON_LIMITE, Feature::Tenants->value => self::NON_LIMITE, Feature::Leases->value => self::NON_LIMITE, Feature::Inspections->value => self::NON_LIMITE,
                Feature::Storage->value => 5120, Feature::Users->value => self::NON_LIMITE, Feature::Signatures->value => 20,
            ]],
        ];
    }

    /**
     * @return int plans créés
     */
    public function seed(): int
    {
        $crees = 0;

        foreach (self::definition() as $code => $plan) {
            if (Plan::query()->where('code', $code)->exists()) {
                continue;
            }

            DB::transaction(function () use ($code, $plan): void {
                $modele = Plan::query()->create(['code' => $code, 'name' => $plan['name']]);
                $version = PlanVersion::query()->create(['plan_id' => $modele->id, 'version' => 1, 'status' => PlanVersionStatus::Draft, 'trial_days' => 15, 'public_signup' => true]);

                foreach ($plan['prices'] as $devise => [$mensuel, $annuel]) {
                    PlanPrice::query()->create(['plan_version_id' => $version->id, 'currency' => $devise, 'monthly_amount' => $mensuel, 'yearly_amount' => $annuel]);
                }

                foreach (Feature::cases() as $fonction) {
                    PlanEntitlement::query()->create([
                        'plan_version_id' => $version->id, 'feature_key' => $fonction->value, 'enabled' => true,
                        'limit_value' => $fonction->isQuota() ? ($plan['limits'][$fonction->value] ?? null) : null,
                    ]);
                }

                $version->forceFill(['status' => PlanVersionStatus::Published, 'published_at' => now()])->save();
            });

            $crees++;
        }

        return $crees;
    }
}
