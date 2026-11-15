<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Actions;

use App\Modules\Identity\Models\User;
use App\Modules\Organizations\Data\NewOrganizationData;
use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Organizations\Enums\MemberStatus;
use App\Modules\Organizations\Models\Organization;
use App\Modules\Organizations\Models\OrganizationMember;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Support\Facades\DB;

final readonly class CreateOrganization
{
    public function __construct(private CurrentOrganization $contexte) {}

    public function handle(User $titulaire, NewOrganizationData $donnees, string $firstName, string $lastName): Organization
    {
        return DB::transaction(function () use ($titulaire, $donnees, $firstName, $lastName): Organization {
            $organisation = Organization::query()->create([
                'kind' => $donnees->kind,
                'name' => $donnees->name,
                'country' => $donnees->country,
                'created_by_user_id' => $titulaire->id,
            ]);

            $this->contexte->run($organisation->id, fn (): OrganizationMember => OrganizationMember::query()->create([
                'user_id' => $titulaire->id,
                'email' => mb_strtolower($titulaire->email),
                'first_name' => $firstName,
                'last_name' => $lastName,
                'role' => MemberRole::Owner,
                'status' => MemberStatus::Active,
                'joined_at' => now(),
            ]));

            return $organisation;
        });
    }
}
