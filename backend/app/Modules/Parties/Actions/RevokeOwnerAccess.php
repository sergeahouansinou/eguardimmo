<?php

declare(strict_types=1);

namespace App\Modules\Parties\Actions;

use App\Modules\Identity\Enums\OwnerRevoker;
use App\Modules\Parties\Enums\ErrorCode;
use App\Modules\Parties\Enums\OwnerAccessStatus;
use App\Modules\Parties\Events\OwnerAccessRevoked;
use App\Modules\Parties\Models\OwnerAccess;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;

final readonly class RevokeOwnerAccess
{
    public function __construct(private RecordAudit $audit) {}

    /**
     * Suppose un contexte d'organisation. Révocation par l'organisation, par le titulaire du compte (le sien seulement) ou par le
     * système ; effet immédiat, rien d'autre n'est effacé.
     */
    public function handle(OwnerAccess $access, OwnerRevoker $par, ?string $acteurId): void
    {
        DB::transaction(function () use ($access, $par, $acteurId): void {
            $verrouille = OwnerAccess::query()->whereKey($access->id)->lockForUpdate()->first();

            if ($verrouille === null
                || $verrouille->status !== OwnerAccessStatus::Active
                || ($par === OwnerRevoker::Account && $verrouille->user_id !== $acteurId)) {
                throw ErrorCode::OwnerAccessNotFound->problem();
            }

            $verrouille->forceFill(['status' => OwnerAccessStatus::Revoked, 'revoked_at' => now(), 'revoked_by' => $par])->save();
            OwnerAccessRevoked::dispatch($verrouille->id, $verrouille->organization_id, $verrouille->user_id, $verrouille->mandant_party_id, $par);
            $this->audit->handle('parties.owner_access.unlinked', $acteurId, ['by' => $par->value, 'role' => $verrouille->role->value, 'mandant_party_id' => $verrouille->mandant_party_id], $verrouille);
        });
    }
}
