<?php

declare(strict_types=1);

namespace App\Modules\Identity\Models;

use App\Modules\Identity\Database\Factories\UserFactory;
use App\Modules\Identity\Notifications\ResetPasswordNotification;
use App\Modules\Identity\Notifications\VerifyEmailNotification;
use App\Shared\Audit\Auditable;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Attributes\UseFactory;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Carbon;
use Laravel\Fortify\TwoFactorAuthenticatable;
use Laravel\Sanctum\HasApiTokens;
use Laravel\Sanctum\TransientToken;

/**
 * @property string $id
 * @property string $name
 * @property string $email
 * @property Carbon|null $email_verified_at
 * @property string|null $password
 * @property string|null $two_factor_secret
 * @property string|null $two_factor_recovery_codes
 * @property Carbon|null $two_factor_confirmed_at
 * @property Carbon|null $last_login_at
 * @property Carbon|null $previous_login_at
 * @property-read Operator|null $operator
 */
#[Fillable(['name', 'email', 'password'])]
#[UseFactory(UserFactory::class)]
#[Hidden(['password', 'remember_token', 'two_factor_secret', 'two_factor_recovery_codes'])]
final class User extends Authenticatable implements MustVerifyEmail
{
    use Auditable, HasUuids;

    /** @use HasApiTokens<PersonalAccessToken|TransientToken> */
    use HasApiTokens;

    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable, TwoFactorAuthenticatable;

    /** @var array<string, mixed> */
    protected $attributes = [
        'password' => null,
        'two_factor_secret' => null,
        'two_factor_recovery_codes' => null,
        'two_factor_confirmed_at' => null,
        'last_login_at' => null,
        'previous_login_at' => null,
    ];

    /**
     * @return HasOne<Operator, $this>
     */
    public function operator(): HasOne
    {
        return $this->hasOne(Operator::class);
    }

    /**
     * @return HasMany<SocialIdentity, $this>
     */
    public function socialIdentities(): HasMany
    {
        return $this->hasMany(SocialIdentity::class);
    }

    /**
     * @return HasMany<UserDevice, $this>
     */
    public function devices(): HasMany
    {
        return $this->hasMany(UserDevice::class);
    }

    public function isActiveOperator(): bool
    {
        return $this->operator !== null && $this->operator->revoked_at === null;
    }

    public function hasConfirmedTwoFactor(): bool
    {
        return $this->two_factor_secret !== null && $this->two_factor_confirmed_at !== null;
    }

    public function sendPasswordResetNotification(#[\SensitiveParameter] $token): void
    {
        $this->notify(new ResetPasswordNotification($token));
    }

    public function sendEmailVerificationNotification(): void
    {
        $this->notify(new VerifyEmailNotification);
    }

    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'two_factor_confirmed_at' => 'datetime',
            'last_login_at' => 'datetime',
            'previous_login_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    /**
     * Les changements de sécurité ont leurs propres événements d'audit (auth.*) : pas de doublon.
     *
     * @return list<string>
     */
    public function auditExcluded(): array
    {
        return [
            'password', 'remember_token', 'two_factor_secret', 'two_factor_recovery_codes',
            'two_factor_confirmed_at', 'email_verified_at', 'last_login_at', 'previous_login_at',
        ];
    }

    /**
     * Journal immuable : l'identité ne s'y écrit pas en clair, pour que l'effacement d'un compte reste possible.
     *
     * @return list<string>
     */
    public function auditMasked(): array
    {
        return ['name', 'email'];
    }
}
