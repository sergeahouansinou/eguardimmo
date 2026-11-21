<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Support;

use App\Modules\Documents\PublicApi\DocumentStore;
use App\Modules\Messaging\Models\ConversationAttachment;
use Illuminate\Support\Facades\Storage;

final readonly class AttachmentPurger
{
    public function __construct(private DocumentStore $documents) {}

    /**
     * Efface le contenu d'une pièce de fil (Documents ou ancien disque local) puis sa ligne.
     */
    public function purge(ConversationAttachment $piece): void
    {
        if ($piece->stored_file_id !== null) {
            $this->documents->purgeEarly($piece->stored_file_id);
        } elseif ($piece->path !== null) {
            Storage::disk(AttachmentStore::DISQUE)->delete($piece->path);
        }

        $piece->delete();
    }
}
