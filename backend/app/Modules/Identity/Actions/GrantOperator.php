<?php

declare(strict_types=1);

namespace App\Modules\Identity\Actions;

use App\Modules\Identity\Models\Operator;
use App\Modules\Identity\Models\User;
use App\Modules\Identity\Notifications\OperatorGrantedNotification;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;

final readonly class GrantOperator
{
    public function __construct(private RecordAudit $audit) {}

    /**
     * @param  array<string, string>  $contexte
     */
    public function handle(User $user, ?string $accordePar = null, array $contexte = []): void
    {
        $destinataires = User::query()
            ->whereHas('operator', fn ($requete) => $requete->whereNull('revoked_at'))
            ->whereKeyNot($user->id)
            ->get();

        DB::transaction(function () use ($user, $accordePar): void {
            Operator::query()->updateOrCreate(['user_id' => $user->id], [
                'granted_at' => now(),
                'granted_by_user_id' => $accordePar,
                'revoked_at' => null,
            ]);
        });

        $this->audit->handle('identity.operator.granted', $accordePar, $contexte, $user);
        Notification::send($destinataires->push($user), new OperatorGrantedNotification($user->email));
    }
}
