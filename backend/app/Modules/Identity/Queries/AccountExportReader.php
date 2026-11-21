<?php

declare(strict_types=1);

namespace App\Modules\Identity\Queries;

use App\Modules\Identity\Models\SocialIdentity;
use App\Modules\Identity\Models\User;
use App\Modules\Identity\Models\UserDevice;
use App\Modules\Identity\PublicApi\ProfileRegistry;
use App\Shared\Privacy\ExportSection;

/**
 * Données personnelles d'un compte pour une demande d'accès ou de portabilité : ni mot de passe, ni secret 2FA, ni jeton, ni empreinte d'appareil.
 */
final readonly class AccountExportReader
{
    public function __construct(private ProfileRegistry $profils) {}

    public function forAccount(string $userId): ?ExportSection
    {
        $compte = User::query()->find($userId);

        if ($compte === null) {
            return null;
        }

        return new ExportSection('account', [
            'id' => $compte->id,
            'name' => $compte->name,
            'email' => $compte->email,
            'phone' => $compte->phone,
            'created_at' => $compte->created_at?->toIso8601String(),
            'email_verified_at' => $compte->email_verified_at?->toIso8601String(),
            'last_login_at' => $compte->last_login_at?->toIso8601String(),
            'two_factor_enabled' => $compte->hasConfirmedTwoFactor(),
            'profiles' => array_map(fn ($profil): array => ['space' => $profil->space->value, 'label' => $profil->label], $this->profils->profilesFor($compte->id)),
            'social_identities' => $compte->socialIdentities()->get()->map(fn (SocialIdentity $i): array => [
                'provider' => $i->provider->value,
                'email' => $i->email,
                'last_used_at' => $i->last_used_at?->toIso8601String(),
            ])->all(),
            'devices' => $compte->devices()->get()->map(fn (UserDevice $d): array => ['last_seen_at' => $d->last_seen_at->toIso8601String()])->all(),
        ]);
    }
}
