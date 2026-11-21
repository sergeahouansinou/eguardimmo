<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Data;

use App\Modules\Messaging\Enums\ConversationKind;
use Illuminate\Http\UploadedFile;

final readonly class NewExternalConversationData
{
    /**
     * @param  list<UploadedFile>  $attachments
     */
    public function __construct(
        public ConversationKind $kind,
        public string $partyId,
        public ?string $leaseId,
        public ?string $mandateId,
        public string $subject,
        public string $body,
        public array $attachments,
        public ?string $clientId,
    ) {}
}
