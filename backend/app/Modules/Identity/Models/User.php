<?php

declare(strict_types=1);

namespace App\Modules\Identity\Models;

use App\Modules\Identity\Database\Factories\UserFactory;
use App\Modules\Identity\Enums\IntendedProfile;
use App\Modules\Identity\Enums\OperatorRole;
use App\Modules\Identity\Enums\SocialProvider;
use App\Modules\Identity\Enums\SuspensionReason;
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
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Laravel\Fortify\TwoFactorAuthenticatable;
use Laravel\Sanctum\HasApiTokens;
use Laravel\Sanctum\TransientToken;

/**
 * @property string $id
 * @property string $name
 * @property string $email
 * @property Carbon|null $email_verified_at
 * @property string|null $phone
 * @property Carbon|null $phone_verified_at
 * @property string|null $password
 * @property string|null $two_factor_secret
 * @property string|null $two_factor_recovery_codes
 * @property Carbon|null $two_factor_confirmed_at
 * @property Carbon|null $last_login_at
 * @property Carbon|null $previous_login_at
 * @property IntendedProfile|null $intended_profile
 * @property Carbon|null $deleted_at
 * @property Carbon|null $suspended_at
 * @property SuspensionReason|null $suspension_reason
 * @property string|null $suspended_by_user_id
 * @property string|null $suspension_reviewed_by_user_id
 * @property Carbon|null $suspension_reviewed_at
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
    use HasFactory, Notifiable, SoftDeletes, TwoFactorAuthenticatable {
        TwoFactorAuthenticatable::replaceRecoveryCode as private remplacerCodeDeSecours;
    }

    /** @var array<string, mixed> */
    protected $attributes = [
        'password' => null,
        'two_factor_secret' => null,
        'two_factor_recovery_codes' => null,
        'two_factor_confirmed_at' => null,
        'last_login_at' => null,
        'previous_login_at' => null,
        'phone' => null,
        'phone_verified_at' => null,
        'suspended_at' => null,
        'suspension_reason' => null,
        'suspended_by_user_id' => null,
        'suspension_reviewed_by_user_id' => null,
        'suspension_reviewed_at' => null,
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

    public const DELETED_MARKER = '-deleted-';

    private const LONGUEUR_IDENTIFIANT_MAX = 255;

    /**
     * Suffixe unique qui libère une valeur unique (e-mail, subject social) d'un compte supprimé sans l'effacer.
     */
    public static function withDeletedMarker(string $valeur, string $id): string
    {
        $suffixe = self::DELETED_MARKER.$id;

        return mb_substr($valeur, 0, self::LONGUEUR_IDENTIFIANT_MAX - mb_strlen($suffixe)).$suffixe;
    }

    public function storeAppleRefreshToken(#[\SensitiveParameter] string $jeton, string $clientId): void
    {
        $this->socialIdentities()->where('provider', SocialProvider::Apple->value)->first()
            ?->forceFill(['apple_refresh_token' => $jeton, 'apple_client_id' => $clientId])
            ->save();
    }

    public function isActiveOperator(): bool
    {
        return $this->operator !== null && $this->operator->revoked_at === null;
    }

    /**
     * @return list<OperatorRole>
     */
    public function operatorRoles(): array
    {
        if (! $this->isActiveOperator() || $this->operator === null) {
            return [];
        }

        return array_values($this->operator->roles->map(fn ($role): OperatorRole => $role->role)->all());
    }

    public function isSuspended(): bool
    {
        return $this->suspended_at !== null;
    }

    public function replaceRecoveryCode(#[\SensitiveParameter] string $code): void
    {
        DB::transaction(function () use ($code): void {
            self::query()->whereKey($this->id)->lockForUpdate()->first();
            $this->refresh();

            if ($this->two_factor_recovery_codes === null || ! in_array($code, $this->recoveryCodes(), true)) {
                throw ValidationException::withMessages(['recovery_code' => [__('The provided two factor recovery code was invalid.')]]);
            }

            $this->remplacerCodeDeSecours($code);
        });
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
            'phone' => 'encrypted',
            'phone_verified_at' => 'datetime',
            'two_factor_confirmed_at' => 'datetime',
            'last_login_at' => 'datetime',
            'previous_login_at' => 'datetime',
            'suspended_at' => 'datetime',
            'suspension_reviewed_at' => 'datetime',
            'suspension_reason' => SuspensionReason::class,
            'intended_profile' => IntendedProfile::class,
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
            'two_factor_confirmed_at', 'email_verified_at', 'last_login_at', 'previous_login_at', 'phone_verified_at',
            'suspended_at', 'suspension_reason', 'suspended_by_user_id', 'suspension_reviewed_by_user_id', 'suspension_reviewed_at',
        ];
    }

    /**
     * Journal immuable : l'identité ne s'y écrit pas en clair, pour que l'effacement d'un compte reste possible.
     *
     * @return list<string>
     */
    public function auditMasked(): array
    {
        return ['name', 'email', 'phone'];
    }
}
