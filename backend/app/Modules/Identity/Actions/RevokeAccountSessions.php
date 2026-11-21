<?php

declare(strict_types=1);

namespace App\Modules\Identity\Actions;

use App\Modules\Identity\Models\User;
use App\Modules\Identity\Support\ConsoleAccountGuard;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;

final readonly class RevokeAccountSessions
{
    public function __construct(private RevokeUserCredentials $revocation, private RecordAudit $audit) {}

    public function handle(User $compte, User $operateur): void
    {
        ConsoleAccountGuard::assertActionable($compte);

        DB::transaction(function () use ($compte, $operateur): void {
            $this->revocation->handle($compte, 'console_revocation');
            $this->audit->handle('console.account.sessions_revoked', $operateur->id, [], $compte);
        });
    }
}
