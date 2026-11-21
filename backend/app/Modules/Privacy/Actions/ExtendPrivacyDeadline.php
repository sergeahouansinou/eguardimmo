<?php

declare(strict_types=1);

namespace App\Modules\Privacy\Actions;

use App\Modules\Identity\Models\User;
use App\Modules\Privacy\Enums\ErrorCode;
use App\Modules\Privacy\Enums\EventKind;
use App\Modules\Privacy\Enums\ExtensionReason;
use App\Modules\Privacy\Enums\RequestStatus;
use App\Modules\Privacy\Models\PrivacyRequest;
use App\Modules\Privacy\Queries\PrivacyRequests;
use App\Modules\Privacy\Support\Deadlines;
use App\Modules\Privacy\Support\RequestJournal;
use Illuminate\Support\Facades\DB;

final readonly class ExtendPrivacyDeadline
{
    public function __construct(private PrivacyRequests $demandes, private RequestJournal $journal) {}

    /**
     * Une seule prolongation, de deux mois, décidée avant l'échéance initiale.
     */
    public function handle(string $id, ExtensionReason $motif, User $operateur): PrivacyRequest
    {
        return DB::transaction(function () use ($id, $motif, $operateur): PrivacyRequest {
            $demande = $this->demandes->forUpdate($id);

            if (! $demande->status->isOpen()) {
                throw ErrorCode::RequestClosed->problem();
            }

            if ($demande->extended_until !== null) {
                throw ErrorCode::AlreadyExtended->problem();
            }

            if ($demande->due_at->isPast()) {
                throw ErrorCode::DeadlinePassed->problem();
            }

            $demande->forceFill([
                'extended_until' => Deadlines::extendedUntil($demande->received_at),
                'extension_reason' => $motif,
                'handled_by_user_id' => $operateur->id,
                'status' => RequestStatus::InProgress,
            ])->save();

            $this->journal->record($demande, EventKind::Extended, $operateur->id, ['reason' => $motif->value], 'privacy.request.extended');

            return $demande;
        });
    }
}
