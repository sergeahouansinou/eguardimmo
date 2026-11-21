<?php

declare(strict_types=1);

namespace App\Modules\Leases\Actions;

use App\Modules\Leases\Models\LeaseNoticeRequest;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;

final readonly class ErasePartyNoticeData
{
    public function __construct(private RecordAudit $audit) {}

    /**
     * Efface l'adresse de réexpédition ; la demande, sa lettre figée et son journal de preuve restent (règle de conservation des pièces). Idempotent.
     *
     * @return int demandes dont l'adresse a été effacée
     */
    public function handle(string $partyId): int
    {
        return DB::transaction(function () use ($partyId): int {
            $demandes = LeaseNoticeRequest::query()->where('party_id', $partyId)->whereNotNull('forwarding_address')->orderBy('id')->lockForUpdate()->get();

            foreach ($demandes as $demande) {
                $demande->forceFill(['forwarding_address' => null])->save();
            }

            if ($demandes->isNotEmpty()) {
                $this->audit->handle('leases.notice_requests.erased', null, ['requests' => $demandes->count()], $demandes->first());
            }

            return $demandes->count();
        });
    }
}
