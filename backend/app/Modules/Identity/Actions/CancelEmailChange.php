<?php

declare(strict_types=1);

namespace App\Modules\Identity\Actions;

use App\Modules\Identity\Models\EmailChangeRequest;
use App\Modules\Identity\Models\User;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;

final readonly class CancelEmailChange
{
    public function __construct(private RecordAudit $audit) {}

    public function handle(User $user): void
    {
        DB::transaction(function () use ($user): void {
            $annulees = EmailChangeRequest::query()->where('user_id', $user->id)->whereNull('consumed_at')->update(['consumed_at' => now()]);

            if ($annulees > 0) {
                $this->audit->handle('identity.email_change.cancelled', $user->id);
            }
        });
    }
}
