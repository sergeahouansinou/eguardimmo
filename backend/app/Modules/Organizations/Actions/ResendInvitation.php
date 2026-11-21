<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Actions;

use App\Modules\Organizations\Enums\ErrorCode;
use App\Modules\Organizations\Enums\MemberStatus;
use App\Modules\Organizations\Models\Organization;
use App\Modules\Organizations\Models\OrganizationMember;
use App\Modules\Organizations\Notifications\MemberInvitationNotification;
use App\Modules\Organizations\Support\InvitationLimits;
use App\Modules\Organizations\Support\InvitationToken;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;

final readonly class ResendInvitation
{
    public function __construct(private InvitationLimits $limites) {}

    public function handle(Organization $organisation, OrganizationMember $auteur, OrganizationMember $membre): OrganizationMember
    {
        if ($membre->status !== MemberStatus::Invited) {
            throw ErrorCode::NotInvited->problem();
        }

        $this->limites->beforeResend($organisation, $membre);

        $jeton = DB::transaction(function () use ($membre): string {
            $jeton = InvitationToken::issue($membre);
            $membre->save();

            return $jeton;
        });

        Notification::route('mail', $membre->email)->notify(new MemberInvitationNotification(
            $organisation->name,
            $auteur->first_name.' '.$auteur->last_name,
            InvitationToken::url($jeton),
            $membre->message,
        ));

        return $membre;
    }
}
