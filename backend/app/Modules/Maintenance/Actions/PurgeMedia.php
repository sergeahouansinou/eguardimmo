<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Actions;

use App\Modules\Documents\PublicApi\DocumentStore;
use App\Modules\Maintenance\Enums\ActorKind;
use App\Modules\Maintenance\Enums\EventKind;
use App\Modules\Maintenance\Models\Intervention;
use App\Modules\Maintenance\Queries\PurgeCandidates;
use App\Modules\Maintenance\Support\Settings;
use App\Modules\Parties\PublicApi\PartyDirectory;
use App\Shared\Audit\RecordAudit;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use Throwable;

final readonly class PurgeMedia
{
    public const ERASED = '[effacé]';

    public function __construct(
        private CurrentOrganization $contexte,
        private PurgeCandidates $candidats,
        private DocumentStore $documents,
        private PartyDirectory $parties,
        private RecordAudit $audit,
    ) {}

    /**
     * Tâche quotidienne : purge les photos du locataire des interventions terminées depuis plus de 5 ans (le fichier porte sa propre
     * échéance, Documents refuse avant) et efface le texte libre des demandes dont le signalant est anonymisé ; ses photos suivent leur propre échéance (Documents ne raccourcit jamais une conservation). Les devis, factures
     * et preuves comptables ne sont jamais touchés.
     *
     * @return array{purged: int, erased: int, failures: list<string>}
     */
    public function handle(CarbonImmutable $today): array
    {
        $bilan = ['purged' => 0, 'erased' => 0, 'failures' => []];

        foreach ($this->candidats->organizations($today) as $organisation) {
            try {
                $this->contexte->run($organisation, function () use ($today, &$bilan): void {
                    $bilan['purged'] += $this->purge($today);
                    $bilan['erased'] += $this->erase();
                });
            } catch (Throwable $erreur) {
                report($erreur);
                $bilan['failures'][] = "{$organisation} : {$erreur->getMessage()}";
            }
        }

        return $bilan;
    }

    private function purge(CarbonImmutable $today): int
    {
        $limite = $today->subYears(Settings::tenantMediaRetentionYears());
        $total = 0;

        foreach ($this->candidats->dueFiles($limite) as $fichier) {
            $total += DB::transaction(function () use ($fichier): int {
                $this->documents->purge($fichier->stored_file_id);
                $fichier->delete();
                $this->audit->handle('maintenance.file.purged', metadata: ['intervention_id' => $fichier->intervention_id]);

                return 1;
            });
        }

        return $total;
    }

    private function erase(): int
    {
        $signalants = $this->candidats->reporters();
        $anonymes = array_keys(array_filter($this->parties->findMany($signalants), fn ($partie): bool => $partie->isAnonymized));

        if ($anonymes === []) {
            return 0;
        }

        return DB::transaction(function () use ($anonymes): int {
            $total = 0;

            foreach (Intervention::query()->whereIn('reporter_party_id', $anonymes)->where('description', '<>', self::ERASED)->get() as $intervention) {
                $intervention->forceFill(['title' => self::ERASED, 'description' => self::ERASED, 'room' => null, 'availability' => null, 'custom_fields' => null])->save();

                DB::table('intervention_events')->where('intervention_id', $intervention->id)->where('actor_kind', ActorKind::Tenant->value)->where('kind', EventKind::Comment->value)
                    ->where('text', '<>', self::ERASED)->update(['text' => self::ERASED]);

                $this->audit->handle('maintenance.intervention.erased', subject: $intervention, metadata: ['reference' => $intervention->reference]);
                $total++;
            }

            return $total;
        });
    }
}
