<?php

declare(strict_types=1);

namespace App\Modules\Identity\Actions;

use App\Modules\Identity\Models\User;
use App\Modules\Identity\Models\UserDevice;
use App\Modules\Identity\Notifications\NewDeviceLoginNotification;

final class RecordDeviceLogin
{
    public function handle(User $user, string $source, string $libelle): void
    {
        $empreinte = hash('sha256', $source);

        $connu = UserDevice::query()
            ->where('user_id', $user->id)
            ->where('fingerprint', $empreinte)
            ->update(['last_seen_at' => now()]) > 0;

        if ($connu) {
            return;
        }

        $dejaVu = UserDevice::query()->where('user_id', $user->id)->exists();

        UserDevice::query()->create([
            'user_id' => $user->id,
            'fingerprint' => $empreinte,
            'last_seen_at' => now(),
        ]);

        if ($dejaVu) {
            $user->notify(new NewDeviceLoginNotification($libelle));
        }
    }
}
