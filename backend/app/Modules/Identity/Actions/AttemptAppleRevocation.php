<?php

declare(strict_types=1);

namespace App\Modules\Identity\Actions;

use App\Modules\Identity\Models\SocialIdentity;
use App\Shared\Audit\RecordAudit;
use Throwable;

final readonly class AttemptAppleRevocation
{
    public function __construct(
        private RevokeAppleToken $revocation,
        private RecordAudit $audit,
    ) {}

    /**
     * Un échec ne bloque pas la suppression du compte : le jeton reste chiffré sur l'identité, l'échec est signalé
     * et la commande identity:revoke-deferred-apple-tokens le retente.
     */
    public function handle(SocialIdentity $identite): bool
    {
        if ($identite->apple_refresh_token === null || $identite->apple_client_id === null) {
            return true;
        }

        try {
            $this->revocation->handle($identite->apple_refresh_token, $identite->apple_client_id);
        } catch (Throwable $e) {
            report($e);
            $this->audit->handle('identity.apple.revocation_deferred', $identite->user_id, ['social_identity_id' => $identite->id], $identite);

            return false;
        }

        $identite->forceFill(['apple_refresh_token' => null, 'apple_client_id' => null])->save();
        $this->audit->handle('identity.apple.revoked', $identite->user_id, ['social_identity_id' => $identite->id], $identite);

        return true;
    }
}
