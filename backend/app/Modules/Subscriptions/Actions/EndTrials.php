<?php

declare(strict_types=1);

namespace App\Modules\Subscriptions\Actions;

use App\Modules\Subscriptions\Enums\SubscriptionStatus;
use App\Modules\Subscriptions\Models\Subscription;
use App\Modules\Subscriptions\Queries\SubscriptionRecords;
use App\Shared\Audit\RecordAudit;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Support\Facades\DB;

final readonly class EndTrials
{
    private const LOT = 100;

    public function __construct(private SubscriptionRecords $abonnements, private CurrentOrganization $contexte, private RecordAudit $audit) {}

    /**
     * Fin d'essai sans souscription : retour au plan Gratuit, aucune donnée supprimée ni masquée (ADR 0013).
     *
     * @return int essais terminés
     */
    public function handle(): int
    {
        $termines = 0;

        $this->abonnements->dueTrials()
            ->chunk(self::LOT)
            ->each(function ($lot) use (&$termines): void {
                foreach ($lot as $organisation => $id) {
                    $termines += $this->contexte->run((string) $organisation, fn (): int => DB::transaction(fn (): int => $this->terminer((string) $id)));
                }
            });

        return $termines;
    }

    private function terminer(string $id): int
    {
        $abonnement = Subscription::query()->lockForUpdate()->find($id);

        if ($abonnement === null || $abonnement->status !== SubscriptionStatus::Trialing || $abonnement->trial_ends_at === null || $abonnement->trial_ends_at->isFuture()) {
            return 0;
        }

        $abonnement->forceFill(['status' => SubscriptionStatus::Free])->save();
        $this->audit->handle('subscriptions.subscription.trial_ended', null, ['status' => 'free'], $abonnement);

        return 1;
    }
}
