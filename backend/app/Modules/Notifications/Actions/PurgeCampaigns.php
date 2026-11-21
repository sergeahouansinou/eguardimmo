<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Actions;

use App\Modules\Documents\PublicApi\DocumentStore;
use App\Modules\Notifications\Models\Campaign;
use App\Modules\Notifications\Models\CampaignDelivery;
use App\Modules\Notifications\Queries\CampaignRuns;
use App\Shared\Audit\RecordAudit;
use App\Shared\Http\ApiProblem;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Throwable;

final readonly class PurgeCampaigns
{
    public const string EFFACE = '[effacé]';

    public function __construct(
        private CampaignRuns $lectures,
        private CurrentOrganization $organisation,
        private DocumentStore $documents,
        private RecordAudit $audit,
    ) {}

    /**
     * Politique de conservation (ADR 0033, décision 12), jamais une suppression de ligne : le contenu d'une diffusion de plus de 3 ans est
     * effacé et ses pièces purgées, la trace (dates, effectifs, statuts) reste ; l'adresse et les valeurs de fusion d'un envoi de plus de
     * 13 mois s'effacent, l'empreinte de l'adresse reste (liste d'opposition).
     *
     * Les deux purges sont indépendantes : une pièce qui résiste ou une organisation en erreur n'arrête ni l'autre purge ni les autres
     * diffusions ; chaque échec est rendu dans `failures` (identifiants seulement).
     *
     * @return array{campaigns: int, deliveries: int, failures: list<string>}
     */
    public function handle(): array
    {
        $bilan = ['campaigns' => 0, 'deliveries' => 0, 'failures' => []];

        foreach ($this->lectures->organizationsWithExpiredAddresses(now()->toImmutable()->subMonths(13)) as $organisationId) {
            try {
                $bilan['deliveries'] += $this->organisation->run($organisationId, fn (): int => $this->purgeAddresses());
            } catch (Throwable $erreur) {
                $bilan['failures'][] = $this->echec('addresses', $organisationId, $erreur);
            }
        }

        foreach ($this->lectures->contentExpired(now()->toImmutable()->subYears(3)) as $ligne) {
            try {
                $bilan['campaigns'] += $this->organisation->run($ligne['organization_id'], fn (): int => $this->purgeContent($ligne['id']));
            } catch (Throwable $erreur) {
                $bilan['failures'][] = $this->echec('content', $ligne['id'], $erreur);
            }
        }

        return $bilan;
    }

    private function echec(string $partie, string $id, Throwable $erreur): string
    {
        $cause = $erreur instanceof ApiProblem ? $erreur->problemCode : $erreur::class;
        Log::warning('Purge de diffusion non terminée', ['part' => $partie, 'id' => $id, 'cause' => $cause]);

        return "{$partie} {$id} : {$cause}";
    }

    private function purgeContent(string $campagneId): int
    {
        return DB::transaction(function () use ($campagneId): int {
            $campagne = Campaign::query()->with('attachments')->whereKey($campagneId)->lockForUpdate()->first();

            if ($campagne === null || $campagne->content_purged_at !== null) {
                return 0;
            }

            foreach ($campagne->attachments as $piece) {
                $this->documents->purgeEarly($piece->stored_file_id);
            }

            $campagne->forceFill(['subject' => self::EFFACE, 'body' => self::EFFACE, 'content_purged_at' => now()])->save();
            $this->audit->handle('notifications.campaign.content_purged', subject: $campagne, metadata: ['attachments' => $campagne->attachments->count()]);

            return 1;
        });
    }

    private function purgeAddresses(): int
    {
        return DB::transaction(function (): int {
            $n = CampaignDelivery::query()->whereNotNull('email')
                ->where('created_at', '<', now()->subMonths(13)->format('Y-m-d H:i:s.u'))
                ->update(['email' => null, 'merge_values' => null, 'updated_at' => now()->format('Y-m-d H:i:s.u')]);

            if ($n > 0) {
                $this->audit->handle('notifications.campaign.addresses_purged', metadata: ['deliveries' => $n]);
            }

            return $n;
        });
    }
}
