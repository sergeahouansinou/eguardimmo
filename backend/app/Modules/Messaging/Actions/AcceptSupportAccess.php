<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Actions;

use App\Modules\Identity\Data\TwoFactorProofData;
use App\Modules\Identity\Models\User;
use App\Modules\Messaging\Enums\ErrorCode;
use App\Modules\Messaging\Enums\SupportAccessScope;
use App\Modules\Messaging\Enums\SupportAccessStatus;
use App\Modules\Messaging\Models\SupportAccessGrant;
use App\Modules\Messaging\Support\PendingSupportAccess;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;

/**
 * Le périmètre et la durée d'un accès accepté ne dépassent jamais ce que l'opérateur a demandé.
 */
final readonly class AcceptSupportAccess
{
    public function __construct(private RecordAudit $audit, private PendingSupportAccess $enAttente) {}

    /**
     * @param  list<SupportAccessScope>|null  $scopes
     */
    public function handle(SupportAccessGrant $acces, User $decideur, ?int $heures, ?array $scopes, ?TwoFactorProofData $preuve): SupportAccessGrant
    {
        return DB::transaction(function () use ($acces, $decideur, $heures, $scopes, $preuve): SupportAccessGrant {
            $acces = $this->enAttente->lock($acces);
            $heures ??= $acces->duration_hours;
            $retenus = $scopes === null ? $acces->scopes : array_values(array_unique(array_map(fn (SupportAccessScope $s): string => $s->value, $scopes)));

            if ($heures < 1 || $heures > $acces->duration_hours) {
                throw ErrorCode::SupportAccessDurationInvalid->problem();
            }

            if ($retenus === [] || array_diff($retenus, $acces->scopes) !== []) {
                throw ErrorCode::SupportAccessScopeInvalid->problem();
            }

            $maintenant = now();
            $acces->forceFill([
                'status' => SupportAccessStatus::Active,
                'scopes' => $retenus,
                'duration_hours' => $heures,
                'decided_by_user_id' => $decideur->id,
                'decided_at' => $maintenant,
                'granted_at' => $maintenant,
                'expires_at' => $maintenant->copy()->addHours($heures),
            ])->save();

            $this->audit->handle('messaging.support_access.granted', subject: $acces, metadata: [
                'grant_id' => $acces->id,
                'scopes' => $retenus,
                'duration_hours' => $heures,
                'two_factor_method' => $preuve?->method,
            ]);

            return $acces;
        });
    }
}
