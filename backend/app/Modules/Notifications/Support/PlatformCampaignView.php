<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Support;

use App\Modules\Notifications\Models\PlatformCampaign;
use App\Modules\Notifications\Queries\PlatformCampaigns;

final readonly class PlatformCampaignView
{
    public function __construct(private PlatformCampaigns $campagnes) {}

    public function detail(string $campagneId): PlatformCampaignRow
    {
        $campagne = $this->campagnes->find($campagneId);

        return new PlatformCampaignRow(
            $campagne,
            $this->campagnes->counts([$campagne->id])[$campagne->id] ?? [],
            $this->campagnes->recipientEmails($campagne),
            $this->campagnes->unsubscribed($campagne->id),
        );
    }

    /**
     * @param  list<PlatformCampaign>  $page
     * @return list<PlatformCampaignRow>
     */
    public function rows(array $page): array
    {
        $comptes = $this->campagnes->counts(array_map(fn (PlatformCampaign $campagne): string => $campagne->id, $page));

        return array_map(fn (PlatformCampaign $campagne): PlatformCampaignRow => new PlatformCampaignRow($campagne, $comptes[$campagne->id] ?? []), $page);
    }
}
