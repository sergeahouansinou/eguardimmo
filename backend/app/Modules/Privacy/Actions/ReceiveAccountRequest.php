<?php

declare(strict_types=1);

namespace App\Modules\Privacy\Actions;

use App\Modules\Identity\Models\User;
use App\Modules\Privacy\Enums\ErrorCode;
use App\Modules\Privacy\Enums\EventKind;
use App\Modules\Privacy\Enums\RequestChannel;
use App\Modules\Privacy\Enums\RequestKind;
use App\Modules\Privacy\Enums\RequestStatus;
use App\Modules\Privacy\Enums\VerificationMethod;
use App\Modules\Privacy\Events\PrivacyRequestReceived;
use App\Modules\Privacy\Models\PrivacyRequest;
use App\Modules\Privacy\Support\Deadlines;
use App\Modules\Privacy\Support\RequestJournal;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;

final readonly class ReceiveAccountRequest
{
    public function __construct(private RequestJournal $journal) {}

    /**
     * Demande déposée par la personne connectée : sa session établit son identité. Une seule demande ouverte par type et par compte.
     */
    public function handle(User $demandeur, RequestKind $type): PrivacyRequest
    {
        try {
            return DB::transaction(function () use ($demandeur, $type): PrivacyRequest {
                User::query()->whereKey($demandeur->id)->lockForUpdate()->first();

                $ouverte = PrivacyRequest::query()
                    ->where('requester_user_id', $demandeur->id)
                    ->where('kind', $type)
                    ->whereIn('status', [RequestStatus::Received, RequestStatus::InProgress])
                    ->exists();

                if ($ouverte) {
                    throw ErrorCode::RequestExists->problem();
                }

                $recue = now();
                $demande = PrivacyRequest::query()->create([
                    'requester_user_id' => $demandeur->id,
                    'kind' => $type,
                    'channel' => RequestChannel::Account,
                    'received_at' => $recue,
                    'due_at' => Deadlines::dueAt($recue),
                    'identity_verified_by' => VerificationMethod::AccountSession,
                    'identity_verified_at' => $recue,
                    'status' => RequestStatus::Received,
                ]);

                $this->journal->record($demande, EventKind::Received, $demandeur->id, ['channel' => RequestChannel::Account->value], 'privacy.request.received');

                PrivacyRequestReceived::dispatch($demande->id, $demandeur->id);

                return $demande;
            });
        } catch (UniqueConstraintViolationException) {
            throw ErrorCode::RequestExists->problem();
        }
    }
}
