<?php

declare(strict_types=1);

namespace App\Modules\Identity\PublicApi;

use App\Modules\Identity\Queries\AccountExportReader;
use App\Shared\Privacy\ExportSection;

/**
 * Données personnelles d'un compte pour une demande d'accès ou de portabilité : ni mot de passe, ni secret 2FA, ni jeton, ni empreinte d'appareil.
 */
final readonly class AccountDataExport
{
    public function __construct(private AccountExportReader $lecture) {}

    public function forAccount(string $userId): ?ExportSection
    {
        return $this->lecture->forAccount($userId);
    }
}
