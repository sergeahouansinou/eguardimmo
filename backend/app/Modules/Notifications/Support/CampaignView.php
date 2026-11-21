<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Support;

use App\Modules\Notifications\Models\Campaign;

/**
 * Une diffusion avec ses effectifs par état d'envoi et ses pièces, prête à être servie.
 */
final readonly class CampaignView
{
    /**
     * @param  array<string, int>  $metrics
     * @param  list<array{id: string, name: string, size_bytes: int}>  $attachments
     */
    public function __construct(
        public Campaign $campaign,
        public array $metrics,
        public array $attachments,
    ) {}
}
