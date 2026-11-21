<?php

declare(strict_types=1);

namespace App\Modules\Privacy\Actions;

use App\Modules\Identity\Models\User;
use App\Modules\Privacy\Enums\ErrorCode;
use App\Modules\Privacy\Enums\EventKind;
use App\Modules\Privacy\Enums\RefusalReason;
use App\Modules\Privacy\Enums\RequestStatus;
use App\Modules\Privacy\Events\PrivacyRequestCompleted;
use App\Modules\Privacy\Models\PrivacyRequest;
use App\Modules\Privacy\Queries\PrivacyRequests;
use App\Modules\Privacy\Support\RequestJournal;
use Illuminate\Support\Facades\DB;

final readonly class RefusePrivacyRequest
{
    public function __construct(private PrivacyRequests $demandes, private RequestJournal $journal) {}

    public function handle(string $id, RefusalReason $motif, User $operateur): PrivacyRequest
    {
        return DB::transaction(function () use ($id, $motif, $operateur): PrivacyRequest {
            $demande = $this->demandes->forUpdate($id);

            if (! $demande->status->isOpen()) {
                throw ErrorCode::RequestClosed->problem();
            }

            $demande->forceFill([
                'status' => RequestStatus::Refused,
                'refusal_reason' => $motif,
                'completed_at' => now(),
                'handled_by_user_id' => $operateur->id,
            ])->save();

            $this->journal->record($demande, EventKind::Refused, $operateur->id, ['reason' => $motif->value], 'privacy.request.refused');

            if ($demande->requester_user_id !== null) {
                PrivacyRequestCompleted::dispatch($demande->id, $demande->requester_user_id);
            }

            return $demande;
        });
    }
}
