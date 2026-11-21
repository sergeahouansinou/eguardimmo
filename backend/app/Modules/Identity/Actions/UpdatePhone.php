<?php

declare(strict_types=1);

namespace App\Modules\Identity\Actions;

use App\Modules\Identity\Enums\ErrorCode;
use App\Modules\Identity\Models\User;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;

/**
 * Téléphone déclaratif (ADR 0036) : jamais vérifié, jamais utilisé pour l'authentification.
 */
final readonly class UpdatePhone
{
    public function __construct(private RecordAudit $audit) {}

    public function handle(User $user, ?string $phone): User
    {
        $numero = $phone === null ? null : $this->normalize($phone);

        return DB::transaction(function () use ($user, $numero): User {
            $user->forceFill(['phone' => $numero, 'phone_verified_at' => null])->save();
            $this->audit->handle('identity.phone.updated', $user->id, ['cleared' => $numero === null]);

            return $user;
        });
    }

    private function normalize(string $brut): string
    {
        $numero = preg_replace('/[\s.\-()]/', '', $brut) ?? '';

        if (preg_match('/^\+[1-9]\d{6,14}$/D', $numero) !== 1) {
            throw ErrorCode::PhoneInvalid->problem();
        }

        return $numero;
    }
}
