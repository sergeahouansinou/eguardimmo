<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Support;

use App\Modules\Documents\Enums\ErrorCode as DocumentsError;
use App\Modules\Documents\Enums\ScanStatus;
use App\Modules\Documents\Enums\ScanVerdict;
use App\Modules\Documents\PublicApi\AttachmentScanner;
use App\Modules\Messaging\Models\ConversationAttachment;
use App\Modules\Messaging\Models\SupportAttachment;
use Illuminate\Support\Facades\Storage;

/**
 * Les pièces à `path` (support, fils d'avant ADR 0033) ne passent pas par le stockage probant : elles sont analysées à la première lecture,
 * le verdict est conservé, et seule une pièce `clean` se sert. Analyseur inactif (développement) : aucune analyse, rien n'est persisté.
 */
final readonly class PathAttachmentGate
{
    public function __construct(private AttachmentScanner $analyseur) {}

    public function assertReadable(SupportAttachment|ConversationAttachment $piece, string $chemin): void
    {
        match ($piece->scan_status) {
            ScanStatus::Clean => null,
            ScanStatus::Infected => throw DocumentsError::AttachmentInfected->problem(),
            ScanStatus::Pending, ScanStatus::Unverifiable => $this->analyser($piece, $chemin),
        };
    }

    private function analyser(SupportAttachment|ConversationAttachment $piece, string $chemin): void
    {
        if (! $this->analyseur->enabled()) {
            return;
        }

        $flux = Storage::disk(AttachmentStore::DISQUE)->readStream($chemin);
        $verdict = ScanVerdict::Unverifiable;

        if (is_resource($flux)) {
            try {
                $verdict = $this->analyseur->scan($flux);
            } finally {
                fclose($flux);
            }
        }

        $piece->forceFill([
            'scan_status' => ScanStatus::from($verdict->value),
            'scanned_at' => $verdict === ScanVerdict::Unverifiable ? $piece->scanned_at : now(),
        ])->save();

        match ($verdict) {
            ScanVerdict::Clean => null,
            ScanVerdict::Infected => $this->quarantaine($chemin),
            ScanVerdict::Unverifiable => throw DocumentsError::AttachmentNotReady->problem(),
        };
    }

    private function quarantaine(string $chemin): never
    {
        Storage::disk(AttachmentStore::DISQUE)->delete($chemin);

        throw DocumentsError::AttachmentInfected->problem();
    }
}
