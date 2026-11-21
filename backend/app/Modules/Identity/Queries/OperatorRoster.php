<?php

declare(strict_types=1);

namespace App\Modules\Identity\Queries;

use App\Modules\Identity\Models\Operator;
use Illuminate\Database\Eloquent\Collection;

final class OperatorRoster
{
    public const MAX = 200;

    /**
     * @return Collection<int, Operator>
     */
    public function all(): Collection
    {
        return Operator::query()
            ->with(['user' => fn ($requete) => $requete->withTrashed(), 'roles'])
            ->orderByRaw('revoked_at IS NOT NULL')
            ->orderBy('granted_at')
            ->limit(self::MAX)
            ->get();
    }
}
