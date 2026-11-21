<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Actions;

use App\Modules\Documents\PublicApi\DocumentStore;
use App\Modules\Identity\Models\User;
use App\Modules\Notifications\Enums\CampaignStatus;
use App\Modules\Notifications\Enums\ErrorCode;
use App\Modules\Notifications\Models\Campaign;
use App\Modules\Notifications\Models\CampaignAttachment;
use App\Modules\Notifications\Support\CampaignAccess;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final readonly class RemoveCampaignAttachment
{
    public function __construct(
        private CampaignAccess $acces,
        private DocumentStore $documents,
        private RecordAudit $audit,
    ) {}

    /**
     * Seule une pièce d'un brouillon se retire : rien n'a été envoyé, le fichier est donc purgé tout de suite.
     */
    public function handle(User $auteur, string $campagneId, string $pieceId): void
    {
        $this->acces->assertManager($auteur);

        DB::transaction(function () use ($campagneId, $pieceId): void {
            $campagne = (Str::isUuid($campagneId) ? Campaign::query()->whereKey($campagneId)->lockForUpdate()->first() : null) ?? throw ErrorCode::CampaignNotFound->problem();
            $piece = Str::isUuid($pieceId) ? CampaignAttachment::query()->where('campaign_id', $campagne->id)->whereKey($pieceId)->first() : null;

            if ($piece === null) {
                throw ErrorCode::CampaignAttachmentNotFound->problem();
            }

            if ($campagne->status !== CampaignStatus::Draft) {
                throw ErrorCode::CampaignNotEditable->problem();
            }

            $piece->delete();
            $this->documents->purgeEarly($piece->stored_file_id);
            $this->audit->handle('notifications.campaign.attachment_removed', metadata: ['file_id' => $piece->stored_file_id], subject: $campagne);
        });
    }
}
