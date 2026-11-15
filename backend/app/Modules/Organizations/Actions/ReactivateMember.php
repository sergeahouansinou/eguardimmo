<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Actions;

use App\Modules\Organizations\Enums\ErrorCode;
use App\Modules\Organizations\Enums\MemberStatus;
use App\Modules\Organizations\Models\OrganizationMember;
use Illuminate\Support\Facades\DB;

final class ReactivateMember
{
    public function handle(OrganizationMember $membre): OrganizationMember
    {
        if ($membre->status !== MemberStatus::Disabled) {
            throw ErrorCode::NotDisabled->problem();
        }

        return DB::transaction(function () use ($membre): OrganizationMember {
            $membre->forceFill([
                'status' => $membre->user_id === null ? MemberStatus::Invited : MemberStatus::Active,
                'disabled_at' => null,
            ])->save();

            return $membre;
        });
    }
}
