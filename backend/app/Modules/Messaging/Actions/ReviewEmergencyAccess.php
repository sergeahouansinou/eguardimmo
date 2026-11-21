<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Actions;

use App\Modules\Identity\Models\User;
use App\Modules\Messaging\Enums\ErrorCode;
use App\Modules\Messaging\Enums\SupportAccessKind;
use App\Modules\Messaging\Models\SupportAccessGrant;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;

/**
 * Revue a posteriori d'un accès d'urgence par un autre opérateur que celui qui l'a ouvert. Rejouable : un accès déjà revu reste tel quel.
 */
final readonly class ReviewEmergencyAccess
{
    public function __construct(private RecordAudit $audit) {}

    public function handle(SupportAccessGrant $acces, User $relecteur): SupportAccessGrant
    {
        return DB::transaction(function () use ($acces, $relecteur): SupportAccessGrant {
            $verrouille = SupportAccessGrant::query()->whereKey($acces->id)->lockForUpdate()->firstOrFail();

            if ($verrouille->kind !== SupportAccessKind::Emergency) {
                throw ErrorCode::SupportAccessNotEmergency->problem();
            }

            if ($verrouille->operator_user_id === $relecteur->id) {
                throw ErrorCode::SupportAccessReviewForbidden->problem();
            }

            if ($verrouille->reviewed_at !== null) {
                return $verrouille;
            }

            $verrouille->forceFill(['reviewed_by_user_id' => $relecteur->id, 'reviewed_at' => now()])->save();
            $this->audit->handle('messaging.support_access.reviewed', subject: $verrouille, metadata: ['grant_id' => $verrouille->id, 'read_count' => $verrouille->read_count]);

            return $verrouille;
        });
    }
}
