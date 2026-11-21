<?php

declare(strict_types=1);

namespace App\Modules\Charges\Support;

use App\Modules\Charges\Enums\ErrorCode;
use App\Modules\Charges\Models\ChargeIdempotency;

/**
 * Rejeu des opérations d'émission : même clé et même contenu, même cible ; contenu différent, 409. À appeler dans la transaction, sous verrou.
 */
final class Idempotency
{
    /**
     * @return string|null identifiant de la cible déjà traitée par cette clé, null si la clé est neuve
     */
    public function replayed(string $scope, string $cle, string $empreinte): ?string
    {
        $existante = ChargeIdempotency::query()->where('scope', $scope)->where('idempotency_key', $cle)->first();

        if ($existante === null) {
            return null;
        }

        if (! hash_equals($existante->fingerprint, $empreinte)) {
            throw ErrorCode::IdempotencyKeyReused->problem();
        }

        return $existante->target_id;
    }

    public function remember(string $scope, string $cle, string $empreinte, string $targetId): void
    {
        ChargeIdempotency::query()->create(['scope' => $scope, 'idempotency_key' => $cle, 'fingerprint' => $empreinte, 'target_id' => $targetId]);
    }

    /**
     * @param  array<int|string, mixed>  $contenu
     */
    public static function fingerprint(array $contenu): string
    {
        return hash('sha256', (string) json_encode($contenu, JSON_THROW_ON_ERROR));
    }
}
