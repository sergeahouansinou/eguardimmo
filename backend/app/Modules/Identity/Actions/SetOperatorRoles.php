<?php

declare(strict_types=1);

namespace App\Modules\Identity\Actions;

use App\Modules\Identity\Enums\ErrorCode;
use App\Modules\Identity\Enums\OperatorRole;
use App\Modules\Identity\Models\Operator;
use App\Modules\Identity\Models\OperatorRoleAssignment;
use App\Modules\Identity\Models\User;
use App\Modules\Identity\Notifications\OperatorRolesChangedNotification;
use App\Modules\Identity\Support\LastAdministratorGuard;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use InvalidArgumentException;

final readonly class SetOperatorRoles
{
    public function __construct(private RecordAudit $audit) {}

    /**
     * Remplace l'ensemble des rôles d'un opérateur actif, dans la transaction de l'appelant ou la sienne.
     *
     * @param  list<OperatorRole>  $roles
     * @param  array<string, string>  $contexte
     */
    public function replace(Operator $operateur, array $roles, ?string $accordePar = null, array $contexte = [], bool $garderUnAdministrateur = false): void
    {
        DB::transaction(function () use ($operateur, $roles, $accordePar, $contexte, $garderUnAdministrateur): void {
            $avant = $operateur->roles()->get()->map(fn (OperatorRoleAssignment $r): string => $r->role->value)->sort()->values()->all();
            $apres = collect($roles)->map(fn (OperatorRole $r): string => $r->value)->unique()->sort()->values()->all();

            if ($garderUnAdministrateur && in_array(OperatorRole::Admin->value, $avant, true) && ! in_array(OperatorRole::Admin->value, $apres, true)) {
                LastAdministratorGuard::assertAnotherAdministrator($operateur->user_id);
            }

            if (array_diff($apres, $avant) !== [] && $operateur->user()->first()?->hasConfirmedTwoFactor() !== true) {
                throw ErrorCode::TwoFactorNotEnabled->problem();
            }

            $operateur->roles()->whereNotIn('role', $apres)->delete();

            foreach (array_diff($apres, $avant) as $role) {
                $operateur->roles()->create(['role' => $role, 'granted_at' => now(), 'granted_by_user_id' => $accordePar]);
            }

            if ($avant !== $apres) {
                $this->audit->handle('identity.operator.roles_changed', $accordePar, [...$contexte, 'previous' => $avant, 'roles' => $apres], $operateur->user);
            }
        });
    }

    /**
     * @param  list<OperatorRole>  $roles
     * @param  array<string, string>  $contexte
     */
    public function handle(User $user, array $roles, ?string $accordePar = null, array $contexte = [], bool $garderUnAdministrateur = false): bool
    {
        if ($roles === []) {
            throw new InvalidArgumentException('Un opérateur garde au moins un rôle : pour le retirer, révoquez-le.');
        }

        $operateur = Operator::query()->where('user_id', $user->id)->whereNull('revoked_at')->first();

        if ($operateur === null) {
            return false;
        }

        $this->replace($operateur, $roles, $accordePar, $contexte, $garderUnAdministrateur);

        $destinataires = User::query()->whereHas('operator', fn ($requete) => $requete->whereNull('revoked_at'))->get();
        Notification::send($destinataires, new OperatorRolesChangedNotification($user->email));

        return true;
    }
}
