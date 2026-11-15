<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Actions;

use App\Modules\Identity\Models\User;
use App\Modules\Messaging\Models\SupportAccessGrant;
use App\Modules\Messaging\Models\SupportTicket;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;

final readonly class GrantSupportAccess
{
    public const DUREE_MINUTES = 60;

    public function __construct(private RecordAudit $audit) {}

    public function handle(SupportTicket $ticket, User $operateur, string $motif): SupportAccessGrant
    {
        return DB::transaction(function () use ($ticket, $operateur, $motif): SupportAccessGrant {
            $acces = $ticket->accessGrants()->create([
                'operator_user_id' => $operateur->id,
                'reason' => $motif,
                'granted_at' => now(),
                'expires_at' => now()->addMinutes(self::DUREE_MINUTES),
            ]);

            $this->audit->handle('messaging.support_access.granted', subject: $ticket, metadata: [
                'grant_id' => $acces->id,
                'organization_id' => $ticket->organization_id,
                'expires_at' => $acces->expires_at->toIso8601String(),
            ]);

            return $acces;
        });
    }
}
