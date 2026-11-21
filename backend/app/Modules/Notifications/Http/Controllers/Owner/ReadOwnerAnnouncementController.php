<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Http\Controllers\Owner;

use App\Modules\Identity\Models\User;
use App\Modules\Notifications\Actions\ReadAnnouncement;
use App\Modules\Notifications\Enums\CampaignAudience;
use App\Modules\Notifications\Http\Resources\AnnouncementResource;
use Illuminate\Http\Request;

final class ReadOwnerAnnouncementController
{
    public function __invoke(Request $request, string $campaign, ReadAnnouncement $action): AnnouncementResource
    {
        /** @var User $user */
        $user = $request->user();

        return new AnnouncementResource($action->handle($user->id, CampaignAudience::Mandants, $campaign));
    }
}
