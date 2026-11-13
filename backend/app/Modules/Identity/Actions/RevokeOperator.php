<?php

declare(strict_types=1);

namespace App\Modules\Identity\Actions;

use App\Modules\Identity\Models\Operator;
use App\Modules\Identity\Models\User;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;

final readonly class RevokeOperator
{
    public function __construct(private RecordAudit $audit) {}

    /**
     * @param  array<string, string>  $contexte
     */
    public function handle(User $user, ?string $revoquePar = null, array $contexte = []): bool
    {
        $revoque = DB::transaction(function () use ($user): bool {
            $lignes = Operator::query()
                ->where('user_id', $user->id)
                ->whereNull('revoked_at')
                ->update(['revoked_at' => now()]);

            $user->tokens()->where('abilities', 'like', '%"'.IssueConsoleToken::CAPACITE.'"%')->delete();

            return $lignes > 0;
        });

        if ($revoque) {
            $this->audit->handle('identity.operator.revoked', $revoquePar, $contexte, $user);
        }

        return $revoque;
    }
}
