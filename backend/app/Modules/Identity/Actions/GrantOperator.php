<?php

declare(strict_types=1);

namespace App\Modules\Identity\Actions;

use App\Modules\Identity\Enums\OperatorRole;
use App\Modules\Identity\Models\Operator;
use App\Modules\Identity\Models\User;
use App\Modules\Identity\Notifications\OperatorGrantedNotification;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use InvalidArgumentException;
use SensitiveParameter;

final readonly class GrantOperator
{
    public function __construct(private RecordAudit $audit, private SetOperatorRoles $roles, private EnrollTwoFactorOnServer $enrolement) {}

    /**
     * @param  list<OperatorRole>  $roles
     * @param  array<string, string>  $contexte
     * @return list<string>
     */
    public function handle(User $user, array $roles, #[SensitiveParameter] string $secret, #[SensitiveParameter] string $code, ?string $accordePar = null, array $contexte = []): array
    {
        if ($roles === []) {
            throw new InvalidArgumentException('Un opérateur reçoit au moins un rôle.');
        }

        $destinataires = User::query()
            ->whereHas('operator', fn ($requete) => $requete->whereNull('revoked_at'))
            ->whereKeyNot($user->id)
            ->get();

        $codes = DB::transaction(function () use ($user, $roles, $secret, $code, $accordePar, $contexte): array {
            $codes = $this->enrolement->handle($user, $secret, $code, $contexte);

            $operateur = Operator::query()->updateOrCreate(['user_id' => $user->id], [
                'granted_at' => now(),
                'granted_by_user_id' => $accordePar,
                'revoked_at' => null,
            ]);

            $this->roles->replace($operateur, $roles, $accordePar, $contexte);
            $this->audit->handle('identity.operator.granted', $accordePar, [...$contexte, 'roles' => array_map(fn (OperatorRole $r): string => $r->value, $roles)], $user);

            return $codes;
        });

        rescue(fn () => Notification::send($destinataires->push($user), new OperatorGrantedNotification($user->email)));

        return $codes;
    }
}
