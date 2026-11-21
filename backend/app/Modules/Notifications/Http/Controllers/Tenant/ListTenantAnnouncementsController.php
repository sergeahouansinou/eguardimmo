<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Http\Controllers\Tenant;

use App\Modules\Identity\Models\User;
use App\Modules\Notifications\Enums\CampaignAudience;
use App\Modules\Notifications\Http\Requests\ListAnnouncementsRequest;
use App\Modules\Notifications\Http\Resources\AnnouncementResource;
use App\Modules\Notifications\Queries\Announcements;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

final class ListTenantAnnouncementsController
{
    public function __invoke(ListAnnouncementsRequest $request, Announcements $annonces): AnonymousResourceCollection
    {
        /** @var User $user */
        $user = $request->user();

        return AnnouncementResource::collection($annonces->page($user->id, CampaignAudience::Tenants, $request->cursor(), $request->perPage()));
    }
}
