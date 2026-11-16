<?php

declare(strict_types=1);

namespace App\Modules\Accounting\Support;

use App\Modules\Accounting\Enums\AccountRole;
use App\Modules\Accounting\Models\Account;
use Illuminate\Database\UniqueConstraintViolationException;

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
            $ids[$role->value] ??= $this->create($role);
        }

        return $ids;
    }

    /**
     * Le compte créé en parallèle est invisible du snapshot de la transaction : la relecture se fait par lecture verrouillée.
     */
    private function create(AccountRole $role): string
    {
        try {
            return Account::query()->create(['role' => $role->value, 'code' => $role->defaultCode(), 'label' => $role->label()])->id;
        } catch (UniqueConstraintViolationException $erreur) {
            return Account::query()->where('role', $role->value)->lockForUpdate()->firstOr(fn (): never => throw $erreur)->id;
        }
    }
}
