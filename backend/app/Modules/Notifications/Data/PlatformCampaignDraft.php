<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Data;

use App\Modules\Notifications\Enums\MarketingAudience;
use App\Modules\Notifications\Enums\MarketingCategory;
use App\Modules\Notifications\Enums\MarketingChannel;
use Illuminate\Http\UploadedFile;

final readonly class PlatformCampaignDraft
{
    /**
     * @param  list<string>  $recipientEmails  en minuscules et sans doublon
     * @param  array<string, UploadedFile>  $images  par référence citée dans le HTML
     * @param  list<string>  $removedImageIds
     */
    public function __construct(
        public MarketingChannel $channel,
        public MarketingCategory $category,
        public MarketingAudience $audience,
        public ?int $inactivityDays,
        public array $recipientEmails,
        public ?string $subject,
        public ?string $html,
        public ?string $pushTitle,
        public ?string $pushBody,
        public ?string $link,
        public array $images = [],
        public array $removedImageIds = [],
        public ?int $lockVersion = null,
    ) {}
}
