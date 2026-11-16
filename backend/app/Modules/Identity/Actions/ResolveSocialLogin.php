<?php

declare(strict_types=1);

namespace App\Modules\Identity\Actions;

use App\Modules\Identity\Data\SocialIntent;
use App\Modules\Identity\Data\SocialProfileData;
use App\Modules\Identity\Enums\ErrorCode;
use App\Modules\Identity\Enums\SocialIntentType;
use App\Modules\Identity\Events\UserRegistered;
use App\Modules\Identity\Models\SocialIdentity;
use App\Modules\Identity\Models\User;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final readonly class ResolveSocialLogin
{
    public function __construct(private RecordAudit $audit) {}

    public function handle(SocialProfileData $profil, SocialIntent $intention): User
    {
        [$user, $evenement] = DB::transaction(fn (): array => $this->resoudre($profil, $intention));

        $this->audit->handle('auth.social.'.$evenement, $user->id, ['provider' => $profil->provider->value]);

        return $user;
    }

    /**
     * @return array{User, string}
     */
    private function resoudre(SocialProfileData $profil, SocialIntent $intention): array
    {
        $identite = SocialIdentity::query()
            ->where('provider', $profil->provider->value)
            ->where('subject', $profil->subject)
            ->lockForUpdate()
            ->first();

        // Identité restée attachée à un compte supprimé (liaison concurrente) : on la libère au lieu d'échouer.
        if ($identite !== null && User::query()->whereKey($identite->user_id)->doesntExist()) {
            $identite->releaseForDeletedAccount();
            $identite = null;
        }

        if ($identite !== null) {
            if ($intention->type === SocialIntentType::Link && $identite->user_id !== $intention->userId) {
                throw ErrorCode::IdentityAlreadyLinked->problem();
            }

            $identite->forceFill([
                'email' => $profil->email ?? $identite->email,
                'email_verified' => $profil->emailVerified,
                'last_used_at' => now(),
            ])->save();

            return [$identite->user, $intention->type === SocialIntentType::Link ? 'linked' : 'login'];
        }

        if ($intention->type === SocialIntentType::Link) {
            return [$this->rattacher(User::query()->findOrFail($intention->userId), $profil), 'linked'];
        }

        $existant = $profil->email !== null
            ? User::query()->where('email', Str::lower(trim($profil->email)))->first()
            : null;

        if ($existant !== null) {
            if (! $profil->canLinkByEmail() || $existant->email_verified_at === null) {
                throw ErrorCode::AccountExistsLinkRequired->problem();
            }

            return [$this->rattacher($existant, $profil), 'linked'];
        }

        if ($intention->type !== SocialIntentType::Register || $intention->profile === null) {
            throw ErrorCode::NoAccount->problem();
        }

        if ($profil->email === null) {
            throw ErrorCode::EmailRequired->problem();
        }

        $user = new User;
        $user->forceFill([
            'name' => $this->nom($profil),
            'email' => Str::lower(trim($profil->email)),
            'email_verified_at' => $profil->emailVerified ? now() : null,
            'intended_profile' => $intention->profile,
        ])->save();

        $this->rattacher($user, $profil);
        UserRegistered::dispatch($user->id, $intention->profile);

        return [$user, 'registered'];
    }

    private function rattacher(User $user, SocialProfileData $profil): User
    {
        if (User::query()->whereKey($user->id)->lockForUpdate()->doesntExist()) {
            throw ErrorCode::NoAccount->problem();
        }

        $dejaLie = $user->socialIdentities()->where('provider', $profil->provider->value)->exists();

        if ($dejaLie) {
            throw ErrorCode::ProviderAlreadyLinked->problem();
        }

        $user->socialIdentities()->create([
            'provider' => $profil->provider,
            'subject' => $profil->subject,
            'email' => $profil->email,
            'email_verified' => $profil->emailVerified,
            'last_used_at' => now(),
        ]);

        return $user;
    }

    private function nom(SocialProfileData $profil): string
    {
        $nom = trim((string) $profil->name);

        if ($nom !== '') {
            return Str::limit($nom, 255, '');
        }

        return Str::before((string) $profil->email, '@');
    }
}
