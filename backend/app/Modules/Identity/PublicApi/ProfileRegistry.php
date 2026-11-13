<?php

declare(strict_types=1);

namespace App\Modules\Identity\PublicApi;

use App\Modules\Identity\Data\ProfileData;
use App\Modules\Identity\Enums\Space;
use Closure;

final class ProfileRegistry
{
    /** @var list<Closure(string): list<ProfileData>> */
    private array $fournisseurs = [];

    /**
     * @param  Closure(string): list<ProfileData>  $fournisseur
     */
    public function register(Closure $fournisseur): void
    {
        $this->fournisseurs[] = $fournisseur;
    }

    /**
     * @return list<ProfileData>
     */
    public function profilesFor(string $userId): array
    {
        $profils = [];

        foreach ($this->fournisseurs as $fournisseur) {
            array_push($profils, ...$fournisseur($userId));
        }

        return $profils;
    }

    public function has(string $userId, Space $espace): bool
    {
        foreach ($this->profilesFor($userId) as $profil) {
            if ($profil->space === $espace) {
                return true;
            }
        }

        return false;
    }
}
