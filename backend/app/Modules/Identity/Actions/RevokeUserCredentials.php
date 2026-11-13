<?php

declare(strict_types=1);

namespace App\Modules\Identity\Actions;

use App\Modules\Identity\Models\User;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final readonly class RevokeUserCredentials
{
    public function __construct(private RecordAudit $audit) {}

    public function handle(User $user, string $raison, ?string $sessionConservee = null): void
    {
        DB::transaction(function () use ($user, $sessionConservee): void {
            $user->tokens()->delete();

            DB::table((string) config('session.table', 'sessions'))
                ->where('user_id', $user->id)
                ->when($sessionConservee !== null, fn ($requete) => $requete->where('id', '!=', $sessionConservee))
                ->delete();

            $user->forceFill(['remember_token' => Str::random(60)])->save();
        });

        $this->audit->handle('auth.credentials.revoked', $user->id, ['reason' => $raison]);
    }
}
