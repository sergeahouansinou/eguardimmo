<?php

declare(strict_types=1);

namespace App\Modules\Privacy\Actions;

use App\Modules\Identity\Models\User;
use App\Modules\Privacy\Enums\ErrorCode;
use App\Modules\Privacy\Enums\EventKind;
use App\Modules\Privacy\Enums\RequestStatus;
use App\Modules\Privacy\Enums\VerificationMethod;
use App\Modules\Privacy\Models\PrivacyRequest;
use App\Modules\Privacy\Queries\PrivacyRequests;
use App\Modules\Privacy\Support\RequestJournal;
use Illuminate\Support\Facades\DB;

final readonly class VerifyRequesterIdentity
{
    public function __construct(private PrivacyRequests $demandes, private RequestJournal $journal) {}

    /**
     * Consigne comment l'identité a été établie, sans conserver de pièce. Sans effet si elle l'est déjà.
     */
    public function handle(string $id, VerificationMethod $methode, User $operateur): PrivacyRequest
    {
        return DB::transaction(function () use ($id, $methode, $operateur): PrivacyRequest {
            $demande = $this->demandes->forUpdate($id);

            if (! $demande->status->isOpen()) {
                throw ErrorCode::RequestClosed->problem();
            }

            if ($demande->isIdentityVerified()) {
                return $demande;
            }

            $demande->forceFill([
                'identity_verified_by' => $methode,
                'identity_verified_at' => now(),
                'handled_by_user_id' => $operateur->id,
                'status' => RequestStatus::InProgress,
            ])->save();

            $this->journal->record($demande, EventKind::Verified, $operateur->id, ['method' => $methode->value], 'privacy.request.verified');

            return $demande;
        });
    }
}
