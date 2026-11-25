<?php

declare(strict_types=1);

namespace App\Modules\Identity\Queries;

use App\Modules\Identity\Enums\IntendedProfile;
use App\Modules\Identity\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;

/**
 * Groupes de destinataires de la plateforme tenus par les comptes (ADR 0042).
 */
final readonly class PlatformAudiences
{
    public function __construct(private AccountActivity $activite) {}

    /**
     * @return iterable<string>
     */
    public function all(): iterable
    {
        return $this->ids(User::query());
    }

    /**
     * @return iterable<string>
     */
    public function travelers(): iterable
    {
        return $this->ids(User::query()->where('intended_profile', IntendedProfile::Traveler->value));
    }

    /**
     * @return iterable<string>
     */
    public function inactive(int $jours): iterable
    {
        return $this->ids($this->activite->idleSince(CarbonImmutable::now()->subDays($jours)));
    }

    /**
     * @param  Builder<User>  $comptes
     * @return iterable<string>
     */
    private function ids(Builder $comptes): iterable
    {
        return $comptes->select('users.id')->lazyById(1000, 'users.id', 'id')->map(fn (User $compte): string => $compte->id);
    }
}
