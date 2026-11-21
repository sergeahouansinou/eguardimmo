<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Http\Controllers\Owner;

use App\Modules\Identity\Models\User;
use App\Modules\Notifications\Enums\CampaignAudience;
use App\Modules\Notifications\Http\Resources\AnnouncementResource;
use App\Modules\Notifications\Queries\Announcements;
use Illuminate\Http\Request;

final class ShowOwnerAnnouncementController
{
    public function __invoke(Request $request, string $campaign, Announcements $annonces): AnnouncementResource
    {
        /** @var User $user */
        $user = $request->user();

        return new AnnouncementResource($annonces->find($user->id, CampaignAudience::Mandants, $campaign));
    }
}
