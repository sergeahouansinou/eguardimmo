<?php

declare(strict_types=1);

namespace App\Modules\Identity\Actions;

use App\Modules\Identity\Data\RegistrationData;
use App\Modules\Identity\Events\UserRegistered;
use App\Modules\Identity\Models\User;
use App\Modules\Identity\Notifications\AccountAlreadyExistsNotification;
use App\Shared\Audit\RecordAudit;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

final readonly class RegisterUser
{
    public function __construct(private RecordAudit $audit) {}

    public function handle(RegistrationData $donnees): void
    {
        $email = Str::lower(trim($donnees->email));
        $hash = Hash::make($donnees->password);
        $existant = User::query()->where('email', $email)->first();

        if ($existant !== null) {
            $this->signalerDoublon($existant);

            return;
        }

        try {
            $user = DB::transaction(function () use ($donnees, $email, $hash): User {
                $user = User::query()->create([
                    'name' => trim($donnees->name),
                    'email' => $email,
                    'password' => $hash,
                ]);

                UserRegistered::dispatch($user->id, $donnees->intendedProfile);

                return $user;
            });
        } catch (UniqueConstraintViolationException) {
            $this->signalerDoublon(User::query()->where('email', $email)->firstOrFail());

            return;
        }

        $user->sendEmailVerificationNotification();
        $this->audit->handle('auth.register.succeeded', $user->id, ['intended_profile' => $donnees->intendedProfile->value]);
    }

    private function signalerDoublon(User $existant): void
    {
        $existant->notify(new AccountAlreadyExistsNotification);
        $this->audit->handle('auth.register.duplicate', subject: $existant);
    }
}
