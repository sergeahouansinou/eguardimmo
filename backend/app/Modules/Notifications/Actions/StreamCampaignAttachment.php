<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Actions;

use App\Modules\Documents\PublicApi\DocumentStore;
use App\Modules\Notifications\Enums\ErrorCode;
use App\Modules\Notifications\Models\CampaignAttachment;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

final readonly class StreamCampaignAttachment
{
    public function __construct(private DocumentStore $documents) {}

    public function handle(string $campagneId, string $pieceId): StreamedResponse
    {
        $piece = Str::isUuid($campagneId) && Str::isUuid($pieceId)
            ? CampaignAttachment::query()->where('campaign_id', $campagneId)->whereKey($pieceId)->first()
            : null;

        return $this->documents->stream(($piece ?? throw ErrorCode::CampaignAttachmentNotFound->problem())->stored_file_id);
    }
}
