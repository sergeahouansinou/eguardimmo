<?php

declare(strict_types=1);

namespace App\Modules\Notifications\Actions;

use App\Modules\Notifications\Models\Notification;
use App\Modules\Notifications\Models\PushToken;

final readonly class ForgetAccount
{
    public function __construct(private RevokePushTokens $revocation) {}

    /**
     * Compte supprimé (ADR 0004) : les appareils sont révoqués, les notifications archivées, rien n'est effacé.
     */
    public function handle(string $userId): void
    {
        $this->revocation->handle(PushToken::query()->where('user_id', $userId));
        Notification::query()->where('user_id', $userId)->whereNull('archived_at')->update(['archived_at' => now()]);
    }
}
