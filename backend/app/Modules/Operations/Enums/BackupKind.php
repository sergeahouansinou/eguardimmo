<?php

declare(strict_types=1);

namespace App\Modules\Operations\Enums;

enum BackupKind: string
{
    case Database = 'database';
    case Documents = 'documents';
    case RestoreTest = 'restore_test';

    public function isBackup(): bool
    {
        return $this !== self::RestoreTest;
    }
}
