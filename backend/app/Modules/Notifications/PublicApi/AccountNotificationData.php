<?php

declare(strict_types=1);

namespace App\Modules\Notifications\PublicApi;

use App\Modules\Notifications\Queries\AccountNotificationExport;
use App\Shared\Privacy\ExportSection;

/**
 * Notifications, préférences et appareils d'un compte pour un export de données personnelles : jamais le jeton d'un appareil.
 */
final readonly class AccountNotificationData
{
    public function __construct(private AccountNotificationExport $lecture) {}

    public function forAccount(string $userId): ExportSection
    {
        return $this->lecture->forAccount($userId);
    }
}
