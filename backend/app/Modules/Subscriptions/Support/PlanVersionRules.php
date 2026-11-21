<?php

declare(strict_types=1);

namespace App\Modules\Subscriptions\Support;

use App\Modules\Subscriptions\Enums\ErrorCode;
use App\Modules\Subscriptions\Enums\Feature;
use App\Modules\Subscriptions\Models\PlanVersion;

/**
 * Ce qu'une version doit contenir pour être publiée : tous les droits connus, le socle activé, un prix dans chaque devise.
 */
final class PlanVersionRules
{
    public const DEVISES = ['EUR', 'CAD'];

    public static function assertPublishable(PlanVersion $version): void
    {
        $droits = $version->entitlements->keyBy('feature_key');

        foreach (Feature::cases() as $fonction) {
            $droit = $droits->get($fonction->value);

            if ($droit === null) {
                throw ErrorCode::PlanVersionInvalid->problem("Le droit « {$fonction->label()} » manque à cette version.");
            }

            if ($fonction->group() === 'socle' && ! $droit->enabled) {
                throw ErrorCode::PlanVersionInvalid->problem("Les fonctions du socle sont obligatoires : « {$fonction->label()} » est désactivée.");
            }
        }

        foreach (self::DEVISES as $devise) {
            if ($version->prices->firstWhere('currency', $devise) === null) {
                throw ErrorCode::PlanVersionInvalid->problem("Le prix en {$devise} manque à cette version.");
            }
        }
    }
}
