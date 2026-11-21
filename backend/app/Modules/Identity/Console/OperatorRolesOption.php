<?php

declare(strict_types=1);

namespace App\Modules\Identity\Console;

use App\Modules\Identity\Enums\OperatorRole;
use Illuminate\Console\Command;

final class OperatorRolesOption
{
    /**
     * @return list<OperatorRole>|null null quand l'option est absente ou contient un rôle inconnu (l'erreur est déjà affichée)
     */
    public static function parse(Command $commande): ?array
    {
        $saisis = array_values(array_unique(array_filter((array) $commande->option('role'), is_string(...))));
        $roles = [];

        foreach ($saisis as $saisi) {
            $role = OperatorRole::tryFrom($saisi);

            if ($role === null) {
                $commande->error("Rôle inconnu : {$saisi}. Rôles admis : ".implode(', ', array_map(fn (OperatorRole $r): string => $r->value, OperatorRole::cases())).'.');

                return null;
            }

            $roles[] = $role;
        }

        if ($roles === []) {
            $commande->error('Au moins un --role est obligatoire.');

            return null;
        }

        return $roles;
    }
}
