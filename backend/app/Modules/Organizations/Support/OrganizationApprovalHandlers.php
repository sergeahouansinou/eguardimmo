<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Support;

use App\Modules\Organizations\Actions\ReactivateOrganization;
use App\Modules\Organizations\Actions\SuspendOrganization;
use App\Modules\Organizations\Enums\ErrorCode;
use App\Modules\Organizations\Enums\SuspensionReason;
use App\Modules\Organizations\Queries\ConsoleOrganizations;
use App\Shared\Approval\ApprovalHandlers;
use App\Shared\Approval\ApprovalSubject;
use Illuminate\Validation\ValidationException;

/**
 * Suspension et réactivation d'une organisation : soumises à double validation (ADR 0037).
 */
final readonly class OrganizationApprovalHandlers
{
    public const SUSPEND = 'organizations.suspend';

    public const REACTIVATE = 'organizations.reactivate';

    public function __construct(private SuspendOrganization $suspension, private ReactivateOrganization $reactivation, private ConsoleOrganizations $organisations) {}

    public function register(ApprovalHandlers $registre): void
    {
        $registre->register(
            self::SUSPEND,
            function (string $id, array $charge): ApprovalSubject {
                $motif = is_string($charge['reason_code'] ?? null) ? SuspensionReason::tryFrom($charge['reason_code']) : null;

                if ($motif === null) {
                    throw ValidationException::withMessages(['payload.reason_code' => 'Le motif de suspension est obligatoire : fraude, abus, ordre légal ou sécurité.']);
                }

                $organisation = $this->organisations->find($id);

                if ($organisation->isSuspended()) {
                    throw ErrorCode::OrganizationSuspendedAlready->problem();
                }

                return new ApprovalSubject('organization', $organisation->id, $organisation->id, ['reason_code' => $motif->value]);
            },
            $this->suspension->handle(...),
        );

        $registre->register(
            self::REACTIVATE,
            function (string $id): ApprovalSubject {
                $organisation = $this->organisations->find($id);

                if (! $organisation->isSuspended()) {
                    throw ErrorCode::OrganizationNotSuspended->problem();
                }

                return new ApprovalSubject('organization', $organisation->id, $organisation->id);
            },
            $this->reactivation->handle(...),
        );
    }
}
