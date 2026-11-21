<?php

declare(strict_types=1);

namespace App\Modules\Subscriptions\Actions;

use App\Modules\Subscriptions\Enums\ErrorCode;
use App\Modules\Subscriptions\Enums\Feature;
use App\Modules\Subscriptions\Models\PlanEntitlement;
use App\Modules\Subscriptions\Models\PlanPrice;
use App\Modules\Subscriptions\Models\PlanVersion;
use App\Modules\Subscriptions\Support\PlanVersionDigest;
use App\Modules\Subscriptions\Support\SubscriptionApprovalHandlers;
use App\Shared\Approval\ApprovalHandlers;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;

final readonly class UpdatePlanVersion
{
    public function __construct(private RecordAudit $audit, private ApprovalHandlers $approbations) {}

    /**
     * @param  array<string, mixed>  $donnees  public_signup?, prices?, entitlements? déjà validés
     */
    public function handle(PlanVersion $version, array $donnees, string $operateurId): PlanVersion
    {
        return DB::transaction(function () use ($version, $donnees, $operateurId): PlanVersion {
            $verrouillee = PlanVersion::query()->lockForUpdate()->findOrFail($version->id);

            if (! $verrouillee->isDraft()) {
                throw ErrorCode::PlanVersionNotEditable->problem();
            }

            if ($this->approbations->hasPending(SubscriptionApprovalHandlers::PUBLISH, $verrouillee->id)) {
                throw ErrorCode::PlanVersionPublicationPending->problem();
            }

            $avant = PlanVersionDigest::snapshot($verrouillee);

            if (array_key_exists('public_signup', $donnees)) {
                $verrouillee->forceFill(['public_signup' => (bool) $donnees['public_signup']])->save();
            }

            /** @var list<array{currency: string, monthly_amount: int, yearly_amount: int}> $prix */
            $prix = $donnees['prices'] ?? [];
            foreach ($prix as $ligne) {
                PlanPrice::query()->updateOrCreate(
                    ['plan_version_id' => $verrouillee->id, 'currency' => $ligne['currency']],
                    ['monthly_amount' => $ligne['monthly_amount'], 'yearly_amount' => $ligne['yearly_amount']],
                );
            }

            /** @var list<array{feature: string, enabled: bool, limit_value?: int|null}> $droits */
            $droits = $donnees['entitlements'] ?? [];
            foreach ($droits as $ligne) {
                $fonction = Feature::from($ligne['feature']);
                PlanEntitlement::query()->updateOrCreate(
                    ['plan_version_id' => $verrouillee->id, 'feature_key' => $fonction->value],
                    ['enabled' => $ligne['enabled'], 'limit_value' => $fonction->isQuota() ? ($ligne['limit_value'] ?? null) : null],
                );
            }

            $this->audit->handle('subscriptions.plan_version.updated', $operateurId, [
                'version' => $verrouillee->version,
                'prices' => count($prix),
                'entitlements' => count($droits),
                'public_signup' => array_key_exists('public_signup', $donnees),
                'before' => $avant,
                'after' => PlanVersionDigest::snapshot($verrouillee->refresh()),
            ], $verrouillee);

            return $verrouillee->load(['plan', 'prices', 'entitlements']);
        });
    }
}
