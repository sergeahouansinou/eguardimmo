<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Actions;

use App\Modules\Identity\Models\User;
use App\Modules\Messaging\Enums\SupportAccessStatus;
use App\Modules\Messaging\Models\SupportAccessGrant;
use App\Modules\Messaging\Support\PendingSupportAccess;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;

final readonly class RefuseSupportAccess
{
    public function __construct(private RecordAudit $audit, private PendingSupportAccess $enAttente) {}

    public function handle(SupportAccessGrant $acces, User $decideur): SupportAccessGrant
    {
        return DB::transaction(function () use ($acces, $decideur): SupportAccessGrant {
            $acces = $this->enAttente->lock($acces);
            $acces->forceFill(['status' => SupportAccessStatus::Refused, 'decided_by_user_id' => $decideur->id, 'decided_at' => now()])->save();
            $this->audit->handle('messaging.support_access.refused', subject: $acces, metadata: ['grant_id' => $acces->id]);

            return $acces;
        });
    }
}
