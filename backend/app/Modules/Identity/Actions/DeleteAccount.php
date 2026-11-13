<?php

declare(strict_types=1);

namespace App\Modules\Identity\Actions;

use App\Modules\Identity\Enums\SocialProvider;
use App\Modules\Identity\Events\AccountDeleted;
use App\Modules\Identity\Models\SocialIdentity;
use App\Modules\Identity\Models\User;
use Illuminate\Support\Facades\DB;

final readonly class DeleteAccount
{
    public function __construct(
        private RevokeAppleToken $revocationApple,
        private RevokeUserCredentials $identifiants,
        private RevokeOperator $operateur,
    ) {}

    /**
     * Aucun effacement : le compte est marqué supprimé (deleted_at), son e-mail et ses identités sociales reçoivent
     * un suffixe qui libère une réinscription. Tout se passe sous verrou de la ligne users : une liaison sociale
     * concurrente attend, et une seconde suppression simultanée ne fait rien. Une panne d'Apple annule tout.
     */
    public function handle(User $user): void
    {
        DB::transaction(function () use ($user): void {
            $compte = User::query()->whereKey($user->id)->lockForUpdate()->first();

            if ($compte === null) {
                return;
            }

            $identites = $compte->socialIdentities()->lockForUpdate()->get();

            $identites
                ->filter(fn (SocialIdentity $i): bool => $i->provider === SocialProvider::Apple && $i->apple_refresh_token !== null && $i->apple_client_id !== null)
                ->each(fn (SocialIdentity $i) => $this->revocationApple->handle((string) $i->apple_refresh_token, (string) $i->apple_client_id));

            $emailOrigine = $compte->email;

            $this->operateur->handle($compte, null, ['via' => 'account_deletion']);
            $this->identifiants->handle($compte, 'account_deleted');

            DB::table('password_reset_tokens')->where('email', $emailOrigine)->delete();

            $identites->each(fn (SocialIdentity $i) => $i->releaseForDeletedAccount());

            $compte->forceFill(['email' => User::withDeletedMarker($emailOrigine, $compte->id)])->save();
            $compte->delete();

            AccountDeleted::dispatch($compte->id);
        });
    }
}
