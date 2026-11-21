<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Data;

use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Organizations\Enums\RoleAccess;

final readonly class RoleDomainData
{
    /**
     * @param  list<string>  $routes  motifs de noms de route (`*` remplace n'importe quelle suite)
     * @param  list<string>  $except  motifs retirés de `$routes`
     * @param  array<string, RoleAccess>  $levels  niveau par rôle (valeur de `MemberRole`)
     * @param  bool  $enforcedInCode  vrai quand le middleware laisse passer tous les rôles et que le contrôleur refuse certains d'entre eux
     */
    public function __construct(
        public string $key,
        public array $routes,
        public array $except,
        public array $levels,
        public bool $enforcedInCode,
    ) {}

    public function matches(string $routeName): bool
    {
        return $this->any($this->routes, $routeName) && ! $this->any($this->except, $routeName);
    }

    public function level(MemberRole $role): RoleAccess
    {
        return $this->levels[$role->value] ?? RoleAccess::None;
    }

    public function allows(MemberRole $role, bool $readOnly): bool
    {
        $niveau = $this->level($role);

        return $readOnly ? $niveau->canRead() : $niveau->canChange();
    }

    public function twoFactor(): bool
    {
        foreach ($this->levels as $niveau) {
            if ($niveau === RoleAccess::WriteTwoFactor) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param  list<string>  $motifs
     */
    private function any(array $motifs, string $nom): bool
    {
        foreach ($motifs as $motif) {
            if (fnmatch($motif, $nom)) {
                return true;
            }
        }

        return false;
    }
}
