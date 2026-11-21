<?php

declare(strict_types=1);

namespace App\Modules\Subscriptions\PublicApi;

use App\Modules\Subscriptions\Data\SubscriptionSummaryData;
use App\Modules\Subscriptions\Queries\SubscriptionList;

/**
 * Plan et statut d'abonnement de plusieurs organisations, pour la liste de la console (lecture seule).
 */
final readonly class SubscriptionDirectory
{
    public function __construct(private SubscriptionList $abonnements) {}

    /**
     * @param  list<string>  $organizationIds
     * @return array<string, SubscriptionSummaryData>
     */
    public function summaries(array $organizationIds): array
    {
        return $this->abonnements->summaries($organizationIds);
    }

    /**
     * @return list<string>
     */
    public function organizationIdsWhere(?string $planCode, ?string $status): array
    {
        return $this->abonnements->organizationIdsWhere($planCode, $status);
    }
}
