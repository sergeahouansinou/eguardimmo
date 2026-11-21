<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Actions;

use App\Modules\Notifications\Enums\ErrorCode;
use App\Modules\Notifications\Queries\CampaignRuns;
use App\Modules\Notifications\Support\MailProvider;
use App\Shared\Audit\RecordAudit;
use App\Shared\Http\ApiProblem;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

final readonly class DispatchDueCampaigns
{
    public function __construct(
        private CampaignRuns $lectures,
        private StartCampaign $demarrage,
        private CurrentOrganization $organisation,
        private MailProvider $fournisseur,
        private RecordAudit $audit,
    ) {}

    /**
     * Lance les diffusions programmées échues. Sans fournisseur configuré, elles restent programmées. Un plafond atteint ou une audience
     * devenue vide laisse la diffusion en l'état (la suivante est tentée) : jamais d'envoi hors plafond.
     *
     * @return int diffusions démarrées
     */
    public function handle(): int
    {
        if (! $this->fournisseur->enabled()) {
            return 0;
        }

        $demarrees = 0;

        foreach ($this->lectures->due() as $ligne) {
            try {
                $this->organisation->run($ligne['organization_id'], fn () => $this->demarrage->handle($ligne['id'], $ligne['sent_by_user_id']));
                $demarrees++;
            } catch (ApiProblem $probleme) {
                Log::info('Diffusion programmée non démarrée', ['campaign' => $ligne['id'], 'code' => $probleme->problemCode]);
                $this->signaler($ligne, $probleme);
            }
        }

        return $demarrees;
    }

    /**
     * Un expéditeur qui n'a plus le droit d'envoyer est journalisé une fois par jour et par diffusion, sans donnée personnelle.
     *
     * @param  array{id: string, organization_id: string, sent_by_user_id: string}  $ligne
     */
    private function signaler(array $ligne, ApiProblem $probleme): void
    {
        if ($probleme->problemCode !== ErrorCode::CampaignSenderNotAllowed->value || ! Cache::add('campaigns:sender-blocked:'.$ligne['id'], true, 86400)) {
            return;
        }

        $this->organisation->run($ligne['organization_id'], fn () => $this->audit->handle('notifications.campaign.start_blocked', metadata: ['campaign_id' => $ligne['id'], 'reason' => $probleme->problemCode]));
    }
}
