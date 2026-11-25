<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Queries;

use App\Modules\Identity\Enums\IntendedProfile;
use App\Modules\Identity\Models\User;
use App\Modules\Organizations\Enums\OrganizationKind;
use App\Modules\Organizations\Models\Organization;
use App\Modules\Organizations\Models\OrganizationMember;
use App\Shared\Reminders\ReminderHit;
use App\Shared\Reminders\ReminderWindow;
use App\Shared\Tenancy\AcrossOrganizations;
use Carbon\CarbonImmutable;

/**
 * Déclencheurs de rappel portés par les organisations (ADR 0042).
 */
final class ReminderTargets
{
    /**
     * Comptes inscrits pour ce genre d'organisation sans en avoir rejoint aucune ; départ : la confirmation de l'adresse.
     *
     * @return iterable<ReminderHit>
     */
    public function accountsWithout(IntendedProfile $intention, OrganizationKind $genre, ReminderWindow $fenetre): iterable
    {
        $membres = AcrossOrganizations::query(OrganizationMember::class)
            ->whereNotNull('user_id')
            ->whereIn('organization_id', Organization::query()->where('kind', $genre->value)->select('id'))
            ->select('user_id');

        return User::query()->where('intended_profile', $intention->value)->whereNull('suspended_at')
            ->whereBetween('email_verified_at', [$fenetre->from, $fenetre->to])
            ->whereNotIn('id', $membres)
            ->select(['id', 'email_verified_at'])->lazyById(500)
            ->map(fn (User $compte): ReminderHit => new ReminderHit($compte->id, CarbonImmutable::parse($compte->email_verified_at), accountId: $compte->id));
    }

    /**
     * @return list<string>
     */
    public function suspendedIds(): array
    {
        return array_values(Organization::query()->whereNotNull('suspended_at')->pluck('id')->map(fn (mixed $id): string => (string) $id)->all());
    }

    /**
     * @return iterable<ReminderHit> organisations non suspendues créées dans la fenêtre
     */
    public function created(ReminderWindow $fenetre): iterable
    {
        return Organization::query()->whereNull('suspended_at')
            ->where('created_at', '>=', $fenetre->from->format('Y-m-d H:i:s.u'))
            ->where('created_at', '<=', $fenetre->to->format('Y-m-d H:i:s.u'))
            ->select(['id', 'created_at'])->lazyById(500)
            ->map(fn (Organization $organisation): ReminderHit => new ReminderHit(
                $organisation->id,
                CarbonImmutable::parse($organisation->created_at),
                organizationId: $organisation->id,
            ));
    }
}
