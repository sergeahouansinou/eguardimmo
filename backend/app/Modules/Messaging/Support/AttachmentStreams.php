<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Support;

use App\Modules\Documents\PublicApi\DocumentStore;
use App\Modules\Messaging\Enums\ErrorCode;
use App\Modules\Messaging\Models\ConversationAttachment;
use App\Shared\Tenancy\CurrentOrganization;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * Téléchargement d'une pièce de fil, une fois le fil reconnu dans la clé de l'appelant : stockage probant des documents, journalisé.
 * Les pièces d'avant ADR 0033 (`path`) ne concernent que les fils internes.
 */
final readonly class AttachmentStreams
{
    public function __construct(
        private DocumentStore $documents,
        private CurrentOrganization $organisation,
        private PathAttachmentGate $analyse,
    ) {}

    public function stream(ConversationAttachment $piece): StreamedResponse
    {
        if ($piece->stored_file_id !== null) {
            return $this->organisation->run($piece->organization_id, fn (): StreamedResponse => $this->documents->stream((string) $piece->stored_file_id));
        }

        $chemin = $piece->path;

        if ($chemin === null || ! AttachmentStore::exists($chemin)) {
            throw ErrorCode::AttachmentNotFound->problem();
        }

        $this->analyse->assertReadable($piece, $chemin);

        return AttachmentStore::response($chemin, $piece->original_name, $piece->mime_type);
    }
}
