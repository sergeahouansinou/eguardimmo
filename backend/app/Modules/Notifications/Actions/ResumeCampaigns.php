<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Actions;

use App\Modules\Notifications\Enums\DeliveryStatus;
use App\Modules\Notifications\Models\Campaign;
use App\Modules\Notifications\Models\CampaignDelivery;
use App\Modules\Notifications\Queries\CampaignRuns;
use App\Modules\Notifications\Support\CampaignBatches;
use App\Shared\Tenancy\CurrentOrganization;

final readonly class ResumeCampaigns
{
    public function __construct(
        private CampaignRuns $lectures,
        private CurrentOrganization $organisation,
        private CampaignBatches $paquets,
        private FinalizeCampaign $cloture,
    ) {}

    /**
     * Rattrapage (ADR 0033, décision 10) : une ligne `sending` depuis plus de 30 minutes passe `unknown` et compte en échec, sans renvoi
     * (mieux vaut un e-mail manquant qu'un doublon) ; une ligne jamais prise en charge relance son paquet, ce qui est sans risque.
     *
     * @return int lignes passées `unknown`
     */
    public function handle(): int
    {
        $limite = now()->subMinutes((int) config('notifications.campaigns.stale_minutes'))->format('Y-m-d H:i:s.u');
        $inconnues = 0;

        foreach ($this->lectures->sending() as $ligne) {
            $inconnues += (int) $this->organisation->run($ligne['organization_id'], function () use ($ligne, $limite): int {
                $campagne = Campaign::query()->find($ligne['id']);

                if ($campagne === null) {
                    return 0;
                }

                $abandonnees = CampaignDelivery::query()->where('campaign_id', $campagne->id)
                    ->where('status', DeliveryStatus::Sending->value)->where('attempted_at', '<', $limite)
                    ->update(['status' => DeliveryStatus::Unknown->value, 'updated_at' => now()->format('Y-m-d H:i:s.u')]);

                $enAttente = CampaignDelivery::query()->where('campaign_id', $campagne->id)
                    ->where('status', DeliveryStatus::Queued->value)->where('updated_at', '<', $limite)->exists();

                if ($enAttente) {
                    $this->paquets->dispatch($campagne);
                }

                $this->cloture->handle($campagne->id);

                return $abandonnees;
            });
        }

        return $inconnues;
    }
}
