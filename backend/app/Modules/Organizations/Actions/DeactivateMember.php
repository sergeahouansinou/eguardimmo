<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Actions;

use App\Modules\Organizations\Enums\MemberStatus;
use App\Modules\Organizations\Models\OrganizationMember;
use App\Modules\Organizations\Support\TeamRules;
use Illuminate\Support\Facades\DB;

final class DeactivateMember
{
    public function handle(OrganizationMember $membre, OrganizationMember $auteur): OrganizationMember
    {
        return DB::transaction(function () use ($membre, $auteur): OrganizationMember {
            TeamRules::ensureAlterable($membre, $auteur);

            $membre->forceFill(['status' => MemberStatus::Disabled, 'disabled_at' => now()])->save();

            return $membre;
        });
    }
}
