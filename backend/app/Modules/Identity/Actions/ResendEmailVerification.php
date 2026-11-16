<?php

declare(strict_types=1);

namespace App\Modules\Identity\Actions;

use App\Modules\Identity\Jobs\SendEmailVerificationLink;
use Illuminate\Support\Str;

final readonly class ResendEmailVerification
{
    // Aucune lecture en base ici : le même travail est fait que le compte existe, soit inconnu ou déjà vérifié.
    public function handle(string $email): void
    {
        SendEmailVerificationLink::dispatch(Str::lower(trim($email)));
    }
}
