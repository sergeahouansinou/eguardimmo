<?php

declare(strict_types=1);

namespace App\Modules\Messaging\Support;

use App\Modules\Accounting\PublicApi\LedgerAggregates;
use App\Modules\Identity\Enums\OwnerAccessRole;
use App\Modules\Mandates\Data\OwnerVisibleData;
use App\Modules\Mandates\Enums\ErrorCode as MandatesError;
use App\Modules\Messaging\Enums\ErrorCode;
use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Shared\Http\ApiProblem;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;

/**
 * Écrire dans un fil mandant ↔ agence (ADR 0032, décision 7 ; ADR 0033) : `co_owner` n'écrit jamais ; pendant la grâce, on répond
 * dans un fil existant tant que le compte `OwnerPayable` du mandant n'est pas soldé, on n'en ouvre pas.
 */
final class OwnerWriteGate
{
    /** @var array<string, bool> */
    private array $soldes = [];

    public function __construct(
        private readonly LedgerAggregates $agregats,
        private readonly OrganizationDirectory $organisations,
        private readonly CurrentOrganization $contexte,
    ) {}

    public function assertCanOpen(OwnerVisibleData $visible): void
    {
        $this->assertRole($visible);

        if ($visible->inGrace) {
            throw ErrorCode::ConversationReadOnly->problem();
        }
    }

    public function assertCanReply(OwnerVisibleData $visible): void
    {
        $this->assertRole($visible);

        if ($visible->inGrace && ! $this->nonSolde($visible)) {
            throw ErrorCode::ConversationReadOnly->problem();
        }
    }

    public function canReply(OwnerVisibleData $visible): bool
    {
        try {
            $this->assertCanReply($visible);
        } catch (ApiProblem) {
            return false;
        }

        return true;
    }

    private function assertRole(OwnerVisibleData $visible): void
    {
        if ($visible->role === OwnerAccessRole::CoOwner) {
            throw MandatesError::OwnerRoleForbidden->problem();
        }
    }

    private function nonSolde(OwnerVisibleData $visible): bool
    {
        $cle = $visible->organizationId.'|'.$visible->mandantPartyId;

        return $this->soldes[$cle] ??= $this->contexte->run($visible->organizationId, function () use ($visible): bool {
            $fonds = $this->agregats->ownerFunds([$visible->mandantPartyId], $this->organisations->currency(), CarbonImmutable::today())[$visible->mandantPartyId] ?? null;

            return $fonds !== null && (int) $fonds->payable->getAmount() !== 0;
        });
    }
}
