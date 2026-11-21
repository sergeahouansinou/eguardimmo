<?php

declare(strict_types=1);

namespace App\Modules\Banking\Support;

use App\Modules\Banking\Enums\ErrorCode;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Clés d'idempotence HTTP : même clé et même contenu rejouent le résultat, un contenu différent est refusé (409).
 */
final readonly class Idempotency
{
    public function __construct(private CurrentOrganization $organisation) {}

    /**
     * @return array{type: string, id: string}|null le sujet déjà produit, null si la clé est neuve
     */
    public function find(string $cle, string $empreinte): ?array
    {
        $ligne = DB::table('banking_idempotency_keys')
            ->where('organization_id', $this->organisation->id())->where('idempotency_key', $cle)->first();

        if ($ligne === null) {
            return null;
        }

        if (! hash_equals((string) $ligne->fingerprint, $empreinte)) {
            throw ErrorCode::IdempotencyKeyReused->problem();
        }

        return ['type' => (string) $ligne->subject_type, 'id' => (string) $ligne->subject_id];
    }

    /**
     * À appeler dans la transaction qui produit le sujet : une clé concurrente lève une violation d'unicité.
     */
    public function remember(string $cle, string $empreinte, string $type, string $id): void
    {
        $maintenant = Carbon::now();

        DB::table('banking_idempotency_keys')->insert([
            'id' => (string) Str::uuid7(),
            'organization_id' => $this->organisation->id(),
            'idempotency_key' => $cle,
            'fingerprint' => $empreinte,
            'subject_type' => $type,
            'subject_id' => $id,
            'created_at' => $maintenant,
            'updated_at' => $maintenant,
        ]);
    }

    /**
     * @param  callable(): array{type: string, id: string}  $action
     * @return array{replayed: bool, type: string, id: string}
     */
    public function run(string $cle, string $empreinte, callable $action): array
    {
        try {
            return DB::transaction(function () use ($cle, $empreinte, $action): array {
                $rejeu = $this->find($cle, $empreinte);

                if ($rejeu !== null) {
                    return ['replayed' => true, ...$rejeu];
                }

                $sujet = $action();
                $this->remember($cle, $empreinte, $sujet['type'], $sujet['id']);

                return ['replayed' => false, ...$sujet];
            });
        } catch (UniqueConstraintViolationException) {
            $rejeu = $this->find($cle, $empreinte) ?? throw ErrorCode::RequestConflict->problem();

            return ['replayed' => true, ...$rejeu];
        }
    }
}
