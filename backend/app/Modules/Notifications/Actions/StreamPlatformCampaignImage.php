<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Actions;

use App\Modules\Notifications\Queries\PlatformCampaigns;
use App\Modules\Notifications\Support\CampaignImageFiles;
use Illuminate\Http\Response;
use Symfony\Component\HttpFoundation\HeaderUtils;

final readonly class StreamPlatformCampaignImage
{
    public function __construct(
        private PlatformCampaigns $campagnes,
        private CampaignImageFiles $fichiers,
    ) {}

    public function handle(string $campagneId, string $imageId): Response
    {
        $image = $this->campagnes->image($campagneId, $imageId);

        return new Response($this->fichiers->contents($image), 200, [
            'Content-Type' => $image->mime,
            'Content-Length' => (string) $image->size_bytes,
            'Content-Disposition' => HeaderUtils::makeDisposition(HeaderUtils::DISPOSITION_INLINE, $image->name, 'image.'.pathinfo($image->path, PATHINFO_EXTENSION)),
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }
}
