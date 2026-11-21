<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Data;

use App\Modules\Messaging\Enums\RequesterSpace;
use App\Modules\Messaging\Enums\TicketCategory;
use Illuminate\Http\UploadedFile;

final readonly class NewTicketData
{
    /**
     * @param  list<UploadedFile>  $attachments
     */
    public function __construct(
        public RequesterSpace $space,
        public ?string $organizationId,
        public TicketCategory $category,
        public string $subject,
        public string $body,
        public array $attachments,
        public ?string $clientId = null,
    ) {}
}
