<?php

declare(strict_types=1);

namespace App\Modules\Identity\Queries;

use App\Modules\Identity\Data\AccountContactData;
use App\Modules\Identity\Models\User;
use Illuminate\Support\Str;

/**
 * Nom et adresse d'un compte actif, pour traiter une demande qui le concerne ; un compte supprimé n'a plus de coordonnées.
 */
final readonly class AccountContactLookup
{
    public function idByEmail(string $email): ?string
    {
        return User::query()->where('email', Str::lower(trim($email)))->value('id');
    }

    /**
     * @param  list<string>  $userIds
     * @return array<string, AccountContactData> par identifiant de compte
     */
    public function contacts(array $userIds): array
    {
        if ($userIds === []) {
            return [];
        }

        return User::query()->whereKey($userIds)->get(['id', 'name', 'email'])
            ->mapWithKeys(fn (User $compte): array => [$compte->id => new AccountContactData($compte->id, $compte->name, $compte->email)])
            ->all();
    }
}
