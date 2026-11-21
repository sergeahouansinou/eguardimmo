<?php

declare(strict_types=1);

namespace App\Modules\Privacy\Actions;

use App\Modules\Identity\Models\User;
use App\Modules\Privacy\Enums\ErrorCode;
use App\Modules\Privacy\Enums\EventKind;
use App\Modules\Privacy\Queries\PrivacyRequests;
use App\Modules\Privacy\Support\ExportBuilder;
use App\Modules\Privacy\Support\RequestJournal;
use Illuminate\Support\Facades\DB;

final readonly class PrepareExportDownload
{
    public function __construct(private PrivacyRequests $demandes, private ExportBuilder $export, private RequestJournal $journal) {}

    /**
     * Le demandeur seul lit l'export de sa demande, pendant sa durée de validité ; chaque téléchargement est tracé.
     */
    public function handle(User $demandeur, string $id): string
    {
        $demande = $this->demandes->findOwned($demandeur->id, $id);

        if ($demande->export_generated_at === null) {
            throw ErrorCode::ExportUnavailable->problem();
        }

        if ($demande->export_path === null || $demande->export_expires_at === null || $demande->export_expires_at->isPast()) {
            throw ErrorCode::ExportExpired->problem();
        }

        $contenu = $this->export->read($demande->export_path) ?? throw ErrorCode::ExportExpired->problem();

        DB::transaction(function () use ($demande, $demandeur): void {
            $demande->forceFill(['export_downloaded_at' => now()])->save();
            $this->journal->record($demande, EventKind::Downloaded, $demandeur->id, [], 'privacy.export.downloaded');
        });

        return $contenu;
    }
}
