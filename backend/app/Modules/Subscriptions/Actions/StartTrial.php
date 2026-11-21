<?php

declare(strict_types=1);

namespace App\Modules\Subscriptions\Actions;

use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Modules\Subscriptions\Enums\SubscriptionStatus;
use App\Modules\Subscriptions\Models\Subscription;
use App\Modules\Subscriptions\Queries\Plans;
use App\Modules\Subscriptions\Queries\SubscriptionRecords;
use App\Shared\Audit\RecordAudit;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Support\Facades\DB;

final readonly class StartTrial
{
    public const PLAN_DE_DEPART = 'free';

    public function __construct(private Plans $plans, private SubscriptionRecords $abonnements, private CurrentOrganization $contexte, private RecordAudit $audit, private OrganizationDirectory $organisations) {}

    /**
     * Idempotent : une organisation a au plus un abonnement. Sans grille chargée, rien n'est créé (`subscriptions:verify` le signale).
     * La devise de l'essai est celle du siège, lue chez Organizations : l'appelant ne la fournit ni ne la déduit du pays.
     */
    public function handle(string $organizationId): ?Subscription
    {
        $version = $this->plans->latestPublished(self::PLAN_DE_DEPART);

        if ($version === null) {
            return null;
        }

        return DB::transaction(function () use ($organizationId, $version): Subscription {
            $existant = $this->abonnements->forOrganization($organizationId, true);

            if ($existant !== null) {
                return $existant;
            }

            return $this->contexte->run($organizationId, function () use ($version): Subscription {
                $abonnement = Subscription::query()->create([
                    'plan_version_id' => $version->id,
                    'status' => SubscriptionStatus::Trialing,
                    'trial_ends_at' => now()->addDays($version->trial_days),
                    'currency' => $this->organisations->currency()->getCode(),
                ]);

                $this->audit->handle('subscriptions.subscription.created', null, ['status' => $abonnement->status->value, 'trial_days' => $version->trial_days], $abonnement);

                return $abonnement;
            });
        });
    }
}
