<?php

declare(strict_types=1);

namespace App\Modules\Identity\Queries;

use App\Modules\Identity\Data\AccountFileData;
use App\Modules\Identity\Enums\ErrorCode;
use App\Modules\Identity\Enums\Space;
use App\Modules\Identity\Models\User;
use App\Modules\Identity\PublicApi\ProfileRegistry;
use Illuminate\Support\Str;

/**
 * Fiche d'un compte vue de la console : types de profil et nombre d'organisations, jamais leurs noms.
 */
final readonly class AccountFiles
{
    public function __construct(private ProfileRegistry $profils) {}

    public function byEmail(string $email): ?User
    {
        return User::withTrashed()->where('email', Str::lower(trim($email)))->first();
    }

    public function find(string $id): User
    {
        $compte = Str::isUuid($id) ? User::withTrashed()->with('operator')->find(strtolower($id)) : null;

        return $compte ?? throw ErrorCode::AccountNotFound->problem();
    }

    public function file(User $compte): AccountFileData
    {
        $supprime = $compte->trashed();
        $profils = $supprime ? [] : $this->profils->profilesFor($compte->id);
        $codes = $compte->hasConfirmedTwoFactor() ? count($compte->recoveryCodes()) : null;

        return new AccountFileData(
            id: $compte->id,
            name: $compte->name,
            email: $supprime ? null : $compte->email,
            createdAt: $compte->created_at,
            emailVerifiedAt: $compte->email_verified_at,
            lastLoginAt: $compte->last_login_at,
            deletedAt: $compte->deleted_at,
            isOperator: $compte->isActiveOperator(),
            suspendedAt: $compte->suspended_at,
            suspensionReason: $compte->suspension_reason?->value,
            suspensionReviewedAt: $compte->suspension_reviewed_at,
            twoFactorEnabled: $compte->hasConfirmedTwoFactor(),
            recoveryCodesRemaining: $codes,
            devicesCount: $compte->devices()->count(),
            tokensCount: $compte->tokens()->count(),
            profileTypes: array_values(array_unique(array_map(fn ($p): string => $p->space->value, $profils))),
            organizationsCount: count(array_filter($profils, fn ($p): bool => $p->space === Space::Organization)),
        );
    }
}
