<?php

declare(strict_types=1);

namespace App\Modules\Identity\Actions;

use App\Modules\Identity\Enums\OperatorRole;
use App\Modules\Identity\Models\Operator;
use App\Modules\Identity\Models\User;
use App\Modules\Identity\Support\LastAdministratorGuard;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;

final readonly class RevokeOperator
{
    public function __construct(private RecordAudit $audit) {}

    /**
     * Le retrait, la suppression des rôles et des jetons console et la trace d'audit se valident ensemble.
     *
     * @param  array<string, string>  $contexte
     */
    public function handle(User $user, ?string $revoquePar = null, array $contexte = [], bool $garderUnAdministrateur = false): bool
    {
        return DB::transaction(function () use ($user, $revoquePar, $contexte, $garderUnAdministrateur): bool {
            $operateur = Operator::query()->where('user_id', $user->id)->whereNull('revoked_at')->lockForUpdate()->first();

            if ($operateur === null) {
                return false;
            }

            if ($garderUnAdministrateur && $operateur->roles()->where('role', OperatorRole::Admin)->exists()) {
                LastAdministratorGuard::assertAnotherAdministrator($user->id);
            }

            $operateur->forceFill(['revoked_at' => now()])->save();
            $operateur->roles()->delete();
            $user->tokens()->where('abilities', 'like', '%"'.IssueConsoleToken::CAPACITE.'"%')->delete();
            $this->audit->handle('identity.operator.revoked', $revoquePar, $contexte, $user);

            return true;
        });
    }
}
