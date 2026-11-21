<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Http\Controllers\Organization;

use App\Modules\Identity\Models\User;
use App\Modules\Notifications\Enums\CampaignAudience;
use App\Modules\Notifications\Http\Resources\CampaignAudiencesResource;
use App\Modules\Notifications\Queries\CampaignAudiences;
use App\Modules\Notifications\Support\CampaignAccess;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;

final class ShowCampaignAudiencesController
{
    public function __invoke(Request $request, CampaignAudiences $audiences, CampaignAccess $acces): CampaignAudiencesResource
    {
        /** @var User $user */
        $user = $request->user();
        $adhesion = $acces->assertManager($user);
        $aujourdhui = CarbonImmutable::today();

        return new CampaignAudiencesResource([
            'tenants' => $audiences->tenantSummary($aujourdhui),
            'mandants' => $acces->allows($adhesion, CampaignAudience::Mandants) ? $audiences->mandantSummary($aujourdhui) : null,
        ]);
    }
}
