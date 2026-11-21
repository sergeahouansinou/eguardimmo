<?php

declare(strict_types=1);

namespace App\Modules\Banking\Support;

use App\Modules\Banking\Notifications\BankAccountChangedNotification;
use App\Modules\Identity\Models\User;
use App\Modules\Organizations\Data\TeamMemberData;
use App\Modules\Organizations\Enums\MemberRole;
use App\Modules\Organizations\PublicApi\MembershipDirectory;
use Illuminate\Support\Facades\Notification;

final readonly class AccountAlert
{
    public function __construct(private MembershipDirectory $equipe) {}

    public function send(string $change): void
    {
        $titulaires = array_map(
            static fn (TeamMemberData $m): string => $m->userId,
            array_values(array_filter($this->equipe->activeTeam(), static fn (TeamMemberData $m): bool => $m->role === MemberRole::Owner)),
        );

        if ($titulaires === []) {
            return;
        }

        Notification::send(User::query()->whereKey($titulaires)->get(), new BankAccountChangedNotification($change));
    }
}
