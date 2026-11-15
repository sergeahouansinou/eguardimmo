<?php

declare(strict_types=1);

namespace App\Modules\Identity\Queries;

use App\Modules\Identity\Data\OperatorData;
use App\Modules\Identity\Models\Operator;
use App\Modules\Identity\Models\User;

final class ActiveOperators
{
    /**
     * @return list<OperatorData>
     */
    public function all(): array
    {
        $operateurs = [];

        foreach (Operator::query()->whereNull('revoked_at')->with('user')->get() as $operateur) {
            $compte = $operateur->user;

            if ($compte instanceof User) {
                $operateurs[] = new OperatorData($operateur->user_id, $compte->name);
            }
        }

        usort($operateurs, fn (OperatorData $a, OperatorData $b): int => strcmp($a->name, $b->name));

        return $operateurs;
    }

    public function has(string $userId): bool
    {
        return Operator::query()->where('user_id', $userId)->whereNull('revoked_at')->exists();
    }
}
