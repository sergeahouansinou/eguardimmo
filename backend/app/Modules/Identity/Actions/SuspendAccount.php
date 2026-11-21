<?php

declare(strict_types=1);

namespace App\Modules\Identity\Actions;

use App\Modules\Identity\Enums\ErrorCode;
use App\Modules\Identity\Enums\SuspensionReason;
use App\Modules\Identity\Models\User;
use App\Modules\Identity\Support\ConsoleAccountGuard;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;

final readonly class SuspendAccount
{
    public function __construct(private RevokeUserCredentials $revocation, private RecordAudit $audit) {}

    public function handle(User $compte, SuspensionReason $motif, User $operateur): User
    {
        return DB::transaction(function () use ($compte, $motif, $operateur): User {
            $verrouille = User::withTrashed()->lockForUpdate()->findOrFail($compte->id);

            ConsoleAccountGuard::assertActionable($verrouille);

            if ($verrouille->isSuspended()) {
                throw ErrorCode::AccountAlreadySuspended->problem();
            }

            $verrouille->forceFill([
                'suspended_at' => now(),
                'suspension_reason' => $motif,
                'suspended_by_user_id' => $operateur->id,
                'suspension_reviewed_by_user_id' => null,
                'suspension_reviewed_at' => null,
            ])->save();

            $this->revocation->handle($verrouille, 'account_suspended');
            $this->audit->handle('console.account.suspended', $operateur->id, ['reason' => $motif->value], $verrouille);

            return $verrouille;
        });
    }
}
