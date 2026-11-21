<?php

declare(strict_types=1);

namespace App\Modules\Identity\Actions;

use App\Modules\Identity\Enums\ErrorCode;
use App\Modules\Identity\Models\User;
use App\Modules\Identity\Support\ConsoleAccountGuard;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;

final readonly class ReviewAccountSuspension
{
    public function __construct(private RecordAudit $audit) {}

    /**
     * Rejouer la revue renvoie le compte sans réécrire la première.
     */
    public function handle(User $compte, User $relecteur): User
    {
        return DB::transaction(function () use ($compte, $relecteur): User {
            $verrouille = User::withTrashed()->lockForUpdate()->findOrFail($compte->id);

            ConsoleAccountGuard::assertActionable($verrouille);

            if (! $verrouille->isSuspended()) {
                throw ErrorCode::AccountNotSuspended->problem();
            }

            if ($verrouille->suspension_reviewed_at !== null) {
                return $verrouille;
            }

            if ($verrouille->suspended_by_user_id === $relecteur->id) {
                throw ErrorCode::SuspensionReviewForbidden->problem();
            }

            $verrouille->forceFill([
                'suspension_reviewed_by_user_id' => $relecteur->id,
                'suspension_reviewed_at' => now(),
            ])->save();

            $this->audit->handle('console.account.suspension_reviewed', $relecteur->id, [], $verrouille);

            return $verrouille;
        });
    }
}
