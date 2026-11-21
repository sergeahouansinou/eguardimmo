<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Actions;

use App\Modules\Organizations\Data\MemberScopeData;
use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Organizations\Models\OrganizationMember;
use App\Modules\Organizations\Support\TeamRules;
use Illuminate\Support\Facades\DB;

final readonly class ChangeMemberAccess
{
    public function __construct(private RefuseUnsupportedScope $refus) {}

    public function handle(OrganizationMember $membre, OrganizationMember $auteur, ?MemberRole $role, ?MemberScopeData $perimetre): OrganizationMember
    {
        $this->refus->handle($perimetre);

        return DB::transaction(function () use ($membre, $auteur, $role, $perimetre): OrganizationMember {
            if ($role !== null && $role !== $membre->role) {
                TeamRules::ensureAlterable($membre, $auteur);
                $membre->role = $role;
            }

            if ($perimetre !== null) {
                $membre->scope_type = $perimetre->type;
                $membre->scope_property_ids = $perimetre->propertyIds === [] ? null : $perimetre->propertyIds;
            }

            $membre->save();

            return $membre;
        });
    }
}
