<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Actions;

use App\Modules\Identity\Models\User;
use App\Modules\Messaging\Enums\ErrorCode;
use App\Modules\Messaging\Enums\SupportAccessStatus;
use App\Modules\Messaging\Models\SupportAccessGrant;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;

/**
 * Rejouable : révoquer un accès déjà révoqué rend le même accès. Un accès refusé ou expiré ne se révoque pas.
 */
final readonly class RevokeSupportAccess
{
    public function __construct(private RecordAudit $audit) {}

    public function handle(SupportAccessGrant $acces, User $auteur): SupportAccessGrant
    {
        return DB::transaction(function () use ($acces, $auteur): SupportAccessGrant {
            $verrouille = SupportAccessGrant::query()->whereKey($acces->id)->lockForUpdate()->firstOrFail();

            if ($verrouille->status === SupportAccessStatus::Revoked) {
                return $verrouille;
            }

            if ($verrouille->status !== SupportAccessStatus::Active) {
                throw ErrorCode::SupportAccessNotPending->problem();
            }

            $verrouille->forceFill(['status' => SupportAccessStatus::Revoked, 'revoked_at' => now(), 'revoked_by_user_id' => $auteur->id])->save();
            $this->audit->handle('messaging.support_access.revoked', subject: $verrouille, metadata: ['grant_id' => $verrouille->id, 'read_count' => $verrouille->read_count]);

            return $verrouille;
        });
    }
}
