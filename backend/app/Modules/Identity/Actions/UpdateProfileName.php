<?php

declare(strict_types=1);

namespace App\Modules\Identity\Actions;

use App\Modules\Identity\Models\User;
use Illuminate\Support\Facades\DB;

final readonly class UpdateProfileName
{
    public function handle(User $user, string $name): User
    {
        return DB::transaction(function () use ($user, $name): User {
            $user->forceFill(['name' => trim($name)])->save();

            return $user;
        });
    }
}
