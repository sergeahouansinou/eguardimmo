<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Actions;

use App\Modules\Notifications\Queries\ActivePushTokens;

final readonly class PrunePushTokens
{
    public function __construct(
        private ActivePushTokens $jetons,
        private RevokePushTokens $revocation,
    ) {}

    /**
     * Révoque les jetons d'appareil dont la session mobile a disparu : l'envoi les ignorait déjà, on efface leur valeur chiffrée.
     */
    public function handle(): int
    {
        return $this->revocation->handle($this->jetons->stale());
    }
}
