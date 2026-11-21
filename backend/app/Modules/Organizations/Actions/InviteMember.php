<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Actions;

use App\Modules\Organizations\Data\InvitationData;
use App\Modules\Organizations\Enums\ErrorCode;
use App\Modules\Organizations\Enums\MemberStatus;
use App\Modules\Organizations\Enums\OrganizationKind;
use App\Modules\Organizations\Models\Organization;
use App\Modules\Organizations\Models\OrganizationMember;
use App\Modules\Organizations\Notifications\MemberInvitationNotification;
use App\Modules\Organizations\Support\InvitationLimits;
use App\Modules\Organizations\Support\InvitationToken;
use App\Modules\Subscriptions\Enums\Feature;
use App\Modules\Subscriptions\PublicApi\Entitlements;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;

final readonly class InviteMember
{
    public function __construct(private RefuseUnsupportedScope $refus, private Entitlements $droits, private InvitationLimits $limites) {}

    public function handle(Organization $organisation, OrganizationMember $auteur, InvitationData $donnees): OrganizationMember
    {
        if ($organisation->kind === OrganizationKind::Individual) {
            throw ErrorCode::SingleMemberOrganization->problem();
        }

        $this->refus->handle($donnees->scope);

        $email = mb_strtolower($donnees->email);

        $this->limites->beforeInvite($organisation, $email);

        [$membre, $jeton] = DB::transaction(function () use ($organisation, $auteur, $donnees, $email): array {
            $this->droits->assertWithin($organisation->id, Feature::Users, fn (): int => OrganizationMember::query()->count());

            $existant = OrganizationMember::query()->withTrashed()->where('email', $email)->lockForUpdate()->first();

            if ($existant !== null && ! $existant->trashed()) {
                throw ErrorCode::AlreadyMember->problem();
            }

            $membre = $existant ?? new OrganizationMember;
            $membre->fill([
                'user_id' => null,
                'email' => $email,
                'first_name' => $donnees->firstName,
                'last_name' => $donnees->lastName,
                'role' => $donnees->role,
                'status' => MemberStatus::Invited,
                'scope_type' => $donnees->scope->type,
                'scope_property_ids' => $donnees->scope->propertyIds === [] ? null : $donnees->scope->propertyIds,
                'message' => $donnees->message,
                'invited_by_user_id' => $auteur->user_id,
                'joined_at' => null,
                'disabled_at' => null,
                'deleted_at' => null,
            ]);
            $jeton = InvitationToken::issue($membre);
            $membre->save();

            return [$membre, $jeton];
        });

        Notification::route('mail', $email)->notify(new MemberInvitationNotification(
            $organisation->name,
            $auteur->first_name.' '.$auteur->last_name,
            InvitationToken::url($jeton),
            $donnees->message,
        ));

        return $membre;
    }
}
