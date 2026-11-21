<?php

declare(strict_types=1);

namespace App\Modules\Recovery\Actions;

use App\Modules\Documents\PublicApi\DocumentStore;
use App\Modules\Recovery\Enums\ErrorCode;
use App\Modules\Recovery\Models\RecoveryBundle;
use App\Modules\Recovery\Models\RecoveryCase;
use App\Modules\Recovery\Models\RecoveryTransmission;
use App\Modules\Recovery\Models\RecoveryTransmissionDownload;
use App\Modules\Recovery\Queries\PublicLinks;
use App\Modules\Recovery\Support\LinkTokens;
use App\Shared\Audit\RecordAudit;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\StreamedResponse;

final readonly class DownloadByToken
{
    public function __construct(
        private PublicLinks $liens,
        private CurrentOrganization $organisation,
        private DocumentStore $documents,
        private RecordAudit $audit,
    ) {}

    /**
     * Un jeton inconnu, malformé, expiré, révoqué ou d'un dossier clos donne la même réponse 404 : rien ne dit lequel des cinq cas c'est.
     * Le lien est revérifié sous verrou ; le téléchargement n'est compté et journalisé (IP, horodatage) que si le fichier se lit.
     */
    public function handle(#[\SensitiveParameter] string $token, string $ip): StreamedResponse
    {
        $trouvee = $this->locate($token);
        $maintenant = Carbon::now();

        return $this->organisation->run($trouvee->organization_id, fn (): StreamedResponse => DB::transaction(function () use ($trouvee, $ip, $maintenant): StreamedResponse {
            [$envoi, $transmission] = $this->usable($trouvee, $maintenant, true);

            $reponse = $this->documents->stream($envoi->stored_file_id);

            RecoveryTransmissionDownload::query()->create(['transmission_id' => $transmission->id, 'ip' => $ip, 'downloaded_at' => $maintenant]);
            $transmission->first_downloaded_at ??= $maintenant;
            $transmission->download_count++;
            $transmission->save();

            $this->audit->handle('recovery.transmission.downloaded', subject: $transmission, metadata: ['bundle' => $envoi->number, 'ip' => $ip]);

            return $reponse;
        }));
    }

    /**
     * Réponse à HEAD : mêmes refus que le téléchargement, mais aucun compteur, aucune ligne de journal, aucun accès au fichier.
     */
    public function probe(#[\SensitiveParameter] string $token): void
    {
        $trouvee = $this->locate($token);
        $maintenant = Carbon::now();

        $this->organisation->run($trouvee->organization_id, fn (): array => $this->usable($trouvee, $maintenant, false));
    }

    private function locate(#[\SensitiveParameter] string $token): RecoveryTransmission
    {
        $trouvee = LinkTokens::wellFormed($token) ? $this->liens->byTokenHash(LinkTokens::hash($token)) : null;

        return $trouvee !== null && $trouvee->isUsable(Carbon::now()) ? $trouvee : throw ErrorCode::LinkNotFound->problem();
    }

    /**
     * Ordre des verrous commun à la clôture : dossier puis transmission.
     *
     * @return array{RecoveryBundle, RecoveryTransmission}
     */
    private function usable(RecoveryTransmission $trouvee, Carbon $maintenant, bool $verrouiller): array
    {
        $envoi = RecoveryBundle::query()->find($trouvee->bundle_id);
        $dossier = $envoi === null ? null : RecoveryCase::query()->whereKey($envoi->case_id)->when($verrouiller, fn ($q) => $q->sharedLock())->first();
        $transmission = RecoveryTransmission::query()->whereKey($trouvee->id)->when($verrouiller, fn ($q) => $q->lockForUpdate())->first();

        if ($envoi === null || $dossier === null || ! $dossier->status->isActive() || $transmission === null || ! $transmission->isUsable($maintenant)) {
            throw ErrorCode::LinkNotFound->problem();
        }

        return [$envoi, $transmission];
    }
}
