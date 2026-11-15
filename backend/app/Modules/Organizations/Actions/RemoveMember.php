<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Actions;

use App\Modules\Organizations\Enums\MemberStatus;
use App\Modules\Organizations\Models\OrganizationMember;
use App\Modules\Organizations\Support\TeamRules;
use Illuminate\Support\Facades\DB;

final class RemoveMember
{
    public function handle(OrganizationMember $membre, OrganizationMember $auteur): void
    {
        DB::transaction(function () use ($membre, $auteur): void {
            if ($membre->status !== MemberStatus::Invited) {
                TeamRules::ensureAlterable($membre, $auteur);
            }

            $membre->forceFill(['invitation_token_hash' => null, 'invitation_expires_at' => null])->save();
            $membre->delete();
        });
    }
}
