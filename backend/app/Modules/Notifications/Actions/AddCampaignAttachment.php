<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Actions;

use App\Modules\Documents\Data\FileSource;
use App\Modules\Documents\Enums\FileCategory;
use App\Modules\Documents\PublicApi\DocumentStore;
use App\Modules\Identity\Models\User;
use App\Modules\Notifications\Enums\CampaignStatus;
use App\Modules\Notifications\Enums\ErrorCode;
use App\Modules\Notifications\Models\Campaign;
use App\Modules\Notifications\Models\CampaignAttachment;
use App\Modules\Notifications\Support\CampaignAccess;
use App\Shared\Audit\RecordAudit;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final readonly class AddCampaignAttachment
{
    public const int MAX_ATTACHMENTS = 3;

    public const int RETENTION_YEARS = 3;

    public function __construct(
        private CampaignAccess $acces,
        private DocumentStore $documents,
        private RecordAudit $audit,
    ) {}

    /**
     * Un brouillon porte trois pièces au plus. Le fichier est conservé trois ans comme la diffusion (ADR 0033, décision 12) ; sans objet
     * rattaché, il se retire tout de suite tant que la diffusion est un brouillon.
     *
     * @return array{id: string, name: string, size_bytes: int}
     */
    public function handle(User $auteur, string $campagneId, UploadedFile $fichier): array
    {
        $this->acces->assertManager($auteur);

        return DB::transaction(function () use ($campagneId, $fichier): array {
            $campagne = (Str::isUuid($campagneId) ? Campaign::query()->whereKey($campagneId)->lockForUpdate()->first() : null) ?? throw ErrorCode::CampaignNotFound->problem();

            if ($campagne->status !== CampaignStatus::Draft) {
                throw ErrorCode::CampaignNotEditable->problem();
            }

            $position = CampaignAttachment::query()->where('campaign_id', $campagne->id)->count();

            if ($position >= self::MAX_ATTACHMENTS) {
                throw ErrorCode::CampaignAttachmentLimit->problem();
            }

            $nom = Str::limit(trim(preg_replace('/[\x00-\x1F\x7F\/\\\\]+/u', ' ', $fichier->getClientOriginalName()) ?? ''), 120, '');
            $stocke = $this->documents->store(
                FileSource::path((string) $fichier->getRealPath()),
                $nom === '' ? 'piece.pdf' : $nom,
                FileCategory::Supporting,
                null,
                now()->addYears(self::RETENTION_YEARS),
            );

            $piece = new CampaignAttachment;
            $piece->forceFill(['campaign_id' => $campagne->id, 'stored_file_id' => $stocke->id, 'position' => $position + 1])->save();
            $this->audit->handle('notifications.campaign.attachment_added', metadata: ['file_id' => $stocke->id], subject: $campagne);

            return ['id' => $piece->id, 'name' => $stocke->displayName, 'size_bytes' => $stocke->sizeBytes];
        });
    }
}
