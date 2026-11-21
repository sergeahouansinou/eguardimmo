<?php

declare(strict_types=1);

namespace App\Modules\Identity\Support;

use App\Modules\Identity\Actions\ReactivateAccount;
use App\Modules\Identity\Actions\ResetAccountTwoFactor;
use App\Modules\Identity\Enums\ErrorCode;
use App\Modules\Identity\Enums\VerificationMethod;
use App\Modules\Identity\Models\User;
use App\Modules\Identity\Queries\AccountFiles;
use App\Shared\Approval\ApprovalHandlers;
use App\Shared\Approval\ApprovalSubject;
use Illuminate\Validation\ValidationException;

/**
 * Actions de compte soumises à double validation (ADR 0037) : vérifie la demande, l'exécution se fait à la validation.
 */
final readonly class AccountApprovalHandlers
{
    public const REACTIVATE = 'identity.account.reactivate';

    public const RESET_TWO_FACTOR = 'identity.account.reset_two_factor';

    public function __construct(private ReactivateAccount $reactivation, private ResetAccountTwoFactor $reinitialisation, private AccountFiles $fiches) {}

    public function register(ApprovalHandlers $registre): void
    {
        $registre->register(
            self::REACTIVATE,
            function (string $id): ApprovalSubject {
                $compte = $this->compte($id);

                if (! $compte->isSuspended()) {
                    throw ErrorCode::AccountNotSuspended->problem();
                }

                return new ApprovalSubject('user', $compte->id);
            },
            $this->reactivation->handle(...),
        );

        $registre->register(
            self::RESET_TWO_FACTOR,
            function (string $id, array $charge): ApprovalSubject {
                $methode = is_string($charge['verification_method'] ?? null) ? VerificationMethod::tryFrom($charge['verification_method']) : null;

                if ($methode === null) {
                    throw ValidationException::withMessages(['payload.verification_method' => 'La méthode de vérification d\'identité est obligatoire et doit être connue.']);
                }

                $compte = $this->compte($id);

                if (! $compte->hasConfirmedTwoFactor()) {
                    throw ErrorCode::TwoFactorNotEnabled->problem();
                }

                return new ApprovalSubject('user', $compte->id, null, ['verification_method' => $methode->value]);
            },
            $this->reinitialisation->handle(...),
        );
    }

    private function compte(string $id): User
    {
        $compte = $this->fiches->find($id);

        ConsoleAccountGuard::assertActionable($compte);

        return $compte;
    }
}
