<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Data;

use Illuminate\Http\UploadedFile;

final readonly class NewConversationData
{
    /**
     * @param  list<UploadedFile>  $attachments
     */
    public function __construct(
        public string $recipientUserId,
        public string $subject,
        public string $body,
        public array $attachments,
    ) {}
}
