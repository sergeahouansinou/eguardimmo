<?php

declare(strict_types=1);

namespace App\Modules\Accounting\Support;

use App\Modules\Accounting\Enums\AccountRole;
use App\Modules\Accounting\Models\Account;

final class ChartOfAccounts
{
    /**
     * Le plan se crée à la demande, compte par compte : l'organisation n'a rien à initialiser.
     *
     * @param  list<AccountRole>  $roles
     * @return array<string, string> identifiant de compte par rôle
     */
    public function idsFor(array $roles): array
    {
        $ids = Account::query()->whereIn('role', array_map(fn (AccountRole $role): string => $role->value, $roles))
            ->toBase()->pluck('id', 'role')->all();

        foreach ($roles as $role) {
            $ids[$role->value] ??= Account::query()
                ->createOrFirst(['role' => $role->value], ['code' => $role->defaultCode(), 'label' => $role->label()])
                ->id;
        }

        return $ids;
    }
}
