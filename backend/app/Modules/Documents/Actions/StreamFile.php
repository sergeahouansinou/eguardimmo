<?php

declare(strict_types=1);

namespace App\Modules\Documents\Actions;

use App\Modules\Documents\Enums\ErrorCode;
use App\Modules\Documents\Enums\FileCategory;
use App\Modules\Documents\Models\StoredFile;
use App\Modules\Documents\Support\ScanGate;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use RuntimeException;
use Symfony\Component\HttpFoundation\StreamedResponse;

final readonly class StreamFile
{
    public function __construct(private RecordAudit $audit) {}

    /**
     * @param  bool  $generic  vrai pour le téléchargement générique : une pièce de messagerie ne se sert que par la clé de son fil, un relevé bancaire que par la route du module Banking (double authentification), un PDF de synthèse fiscale que par la route du module Tax, une pièce de compte de reversement que par la route d'OwnerFunds (double authentification), un fichier de l'espace locataire que par la route dédiée de son module
     */
    public function handle(string $id, bool $generic = false): StreamedResponse
    {
        $fichier = (Str::isUuid($id) ? StoredFile::query()->find($id) : null) ?? throw ErrorCode::FileNotFound->problem();

        if ($generic && ($fichier->isConversationFile() || $fichier->isTenantSpaceFile() || $fichier->category === FileCategory::BankStatement || $fichier->subject_type === 'bank_reconciliation' || $fichier->subject_type === 'tax_summary' || $fichier->isPayoutProofFile())) {
            throw ErrorCode::FileNotFound->problem();
        }

        ScanGate::assertReadable($fichier);

        $disque = Storage::disk($fichier->disk);

        if (! $disque->exists($fichier->path)) {
            report(new RuntimeException("Contenu absent du fichier stocké {$fichier->id}."));

            throw ErrorCode::FileUnavailable->problem();
        }

        $this->audit->handle('documents.file.downloaded', subject: $fichier, metadata: [
            'category' => $fichier->category->value,
            'size_bytes' => $fichier->size_bytes,
        ]);

        $reponse = $disque->download($fichier->path, $fichier->display_name, [
            'Content-Type' => $fichier->mime_type,
            'X-Content-Type-Options' => 'nosniff',
            'Cache-Control' => 'private, no-store',
        ]);
        $reponse->setPrivate();

        return $reponse;
    }
}
