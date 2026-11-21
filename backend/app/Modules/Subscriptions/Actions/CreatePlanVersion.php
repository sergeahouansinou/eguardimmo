<?php

declare(strict_types=1);

namespace App\Modules\Subscriptions\Actions;

use App\Modules\Subscriptions\Enums\ErrorCode;
use App\Modules\Subscriptions\Enums\PlanVersionStatus;
use App\Modules\Subscriptions\Models\Plan;
use App\Modules\Subscriptions\Models\PlanEntitlement;
use App\Modules\Subscriptions\Models\PlanPrice;
use App\Modules\Subscriptions\Models\PlanVersion;
use App\Shared\Audit\RecordAudit;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

final readonly class CreatePlanVersion
{
    public function __construct(private RecordAudit $audit) {}

    /**
     * Brouillon copié de la dernière version du plan ; un seul brouillon à la fois.
     */
    public function handle(Plan $plan, string $operateurId): PlanVersion
    {
        try {
            return DB::transaction(function () use ($plan, $operateurId): PlanVersion {
                Plan::query()->whereKey($plan->id)->lockForUpdate()->firstOrFail();

                $versions = PlanVersion::query()->where('plan_id', $plan->id)->orderByDesc('version')->get();

                if ($versions->contains(fn (PlanVersion $v): bool => $v->status === PlanVersionStatus::Draft)) {
                    throw ErrorCode::PlanDraftExists->problem();
                }

                if ($versions->isEmpty()) {
                    throw ErrorCode::PlanNotFound->problem();
                }

                $source = $versions->firstOrFail();
                $brouillon = PlanVersion::query()->create([
                    'plan_id' => $plan->id,
                    'version' => $source->version + 1,
                    'status' => PlanVersionStatus::Draft,
                    'trial_days' => $source->trial_days,
                    'public_signup' => $source->public_signup,
                ]);

                foreach ($source->prices as $prix) {
                    PlanPrice::query()->create(['plan_version_id' => $brouillon->id, 'currency' => $prix->currency, 'monthly_amount' => $prix->monthly_amount, 'yearly_amount' => $prix->yearly_amount]);
                }

                foreach ($source->entitlements as $droit) {
                    PlanEntitlement::query()->create(['plan_version_id' => $brouillon->id, 'feature_key' => $droit->feature_key, 'enabled' => $droit->enabled, 'limit_value' => $droit->limit_value]);
                }

                $this->audit->handle('subscriptions.plan_version.created', $operateurId, ['plan' => $plan->code, 'version' => $brouillon->version], $brouillon);

                return $brouillon->load(['plan', 'prices', 'entitlements']);
            });
        } catch (UniqueConstraintViolationException) {
            throw ErrorCode::PlanDraftExists->problem();
        }
    }
}
