<?php

declare(strict_types=1);

namespace App\Modules\Identity\Actions;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use SensitiveParameter;

final readonly class CheckPasswordResetToken
{
    public function handle(string $email, #[SensitiveParameter] string $token): bool
    {
        $ligne = DB::table($this->table())
            ->where('email', Str::lower(trim($email)))
            ->first();

        $empreinte = is_string($ligne?->token) ? $ligne->token : AttemptPasswordLogin::HASH_FACTICE;
        $correspond = Hash::check($token, $empreinte);

        return $ligne !== null && $correspond && ! $this->expire($ligne->created_at);
    }

    private function table(): string
    {
        $table = config('auth.passwords.users.table');

        return is_string($table) ? $table : 'password_reset_tokens';
    }

    private function expire(mixed $creeLe): bool
    {
        $minutes = config('auth.passwords.users.expire');

        return ! is_string($creeLe) || Carbon::parse($creeLe)->addMinutes(is_int($minutes) ? $minutes : 60)->isPast();
    }
}
