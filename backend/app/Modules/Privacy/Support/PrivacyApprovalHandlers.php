<?php

declare(strict_types=1);

namespace App\Modules\Privacy\Support;

use App\Modules\Identity\PublicApi\AccountErasure;
use App\Modules\Privacy\Actions\ExecuteErasure;
use App\Modules\Privacy\Enums\ErrorCode;
use App\Modules\Privacy\Enums\RequestKind;
use App\Modules\Privacy\Queries\PrivacyRequests;
use App\Shared\Approval\ApprovalHandlers;
use App\Shared\Approval\ApprovalSubject;
use Illuminate\Validation\ValidationException;

/**
 * Effacement d'un compte à la demande de la personne : soumis à double validation (ADR 0037). Le sujet est la demande, jamais le compte.
 */
final readonly class PrivacyApprovalHandlers
{
    public const ERASURE = 'privacy.erasure.execute';

    public function __construct(private PrivacyRequests $demandes, private AccountErasure $effacement, private ExecuteErasure $execution) {}

    public function register(ApprovalHandlers $registre): void
    {
        $registre->register(self::ERASURE, function (string $id): ApprovalSubject {
            $demande = $this->demandes->find($id);

            if (! $demande->status->isOpen()) {
                throw ErrorCode::RequestClosed->problem();
            }

            if ($demande->kind !== RequestKind::Erasure) {
                throw ValidationException::withMessages(['subject_id' => 'Cette demande n\'est pas une demande d\'effacement.']);
            }

            if ($demande->requester_user_id === null) {
                throw ErrorCode::AccountRequired->problem();
            }

            if (! $demande->isIdentityVerified()) {
                throw ErrorCode::IdentityNotVerified->problem();
            }

            $this->effacement->assertErasable($demande->requester_user_id);

            return new ApprovalSubject('privacy_request', $demande->id, null, ['kind' => $demande->kind->value]);
        }, $this->execution->handle(...));
    }
}
