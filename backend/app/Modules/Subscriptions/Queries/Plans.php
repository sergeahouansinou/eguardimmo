<?php

declare(strict_types=1);

namespace App\Modules\Subscriptions\Queries;

use App\Modules\Subscriptions\Enums\ErrorCode;
use App\Modules\Subscriptions\Enums\Feature;
use App\Modules\Subscriptions\Enums\PlanVersionStatus;
use App\Modules\Subscriptions\Models\Plan;
use App\Modules\Subscriptions\Models\PlanVersion;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Str;

final class Plans
{
    /**
     * @return Collection<int, Plan>
     */
    public function all(): Collection
    {
        return Plan::query()->with(['versions.prices', 'versions.entitlements'])->orderBy('code')->get();
    }

    public function find(string $codeOrId): Plan
    {
        $plan = Plan::query()->with(['versions.prices', 'versions.entitlements'])
            ->where(fn ($q) => Str::isUuid($codeOrId) ? $q->whereKey(strtolower($codeOrId)) : $q->where('code', $codeOrId))
            ->first();

        return $plan ?? throw ErrorCode::PlanNotFound->problem();
    }

    public function version(string $id): PlanVersion
    {
        $version = Str::isUuid($id) ? PlanVersion::query()->with(['plan', 'prices', 'entitlements'])->find(strtolower($id)) : null;

        return $version ?? throw ErrorCode::PlanNotFound->problem();
    }

    public function latestPublished(string $planCode): ?PlanVersion
    {
        return PlanVersion::query()
            ->whereHas('plan', fn ($q) => $q->where('code', $planCode))
            ->where('status', PlanVersionStatus::Published)
            ->orderByDesc('version')
            ->first();
    }

    /**
     * Nom du plan le moins cher dont la version publiée couvre `$besoin` objets de la fonction (null si aucun).
     */
    public function sufficientFor(Feature $fonction, int $besoin): ?string
    {
        $candidats = PlanVersion::query()
            ->with(['plan', 'prices', 'entitlements'])
            ->where('status', PlanVersionStatus::Published)
            ->get()
            ->filter(function (PlanVersion $v) use ($fonction, $besoin): bool {
                $droit = $v->entitlements->firstWhere('feature_key', $fonction->value);

                return $droit !== null && $droit->enabled && ($droit->limit_value === null || $droit->limit_value >= $besoin);
            })
            ->sortBy(fn (PlanVersion $v): int => (int) ($v->prices->where('currency', 'EUR')->min('monthly_amount') ?? PHP_INT_MAX));

        return $candidats->first()?->plan->name;
    }
}
