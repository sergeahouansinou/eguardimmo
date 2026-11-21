<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Support;

use App\Modules\Accounting\PublicApi\LedgerAggregates;
use App\Modules\Identity\Enums\OwnerAccessRole;
use App\Modules\Mandates\Data\OwnerVisibleData;
use App\Modules\Mandates\PublicApi\MandateDirectory;
use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Modules\OwnerFunds\Enums\ErrorCode;
use App\Shared\Http\ApiProblem;
use Carbon\CarbonImmutable;
use Illuminate\Support\Str;

/**
 * Qui peut toucher au compte de paiement d'un mandant (ADR 0032, décisions 2 et 7) : l'accès vient de la clé du compte, jamais
 * d'un identifiant du client.
 */
final readonly class OwnerPayoutGate
{
    public function __construct(
        private MandateDirectory $mandats,
        private LedgerAggregates $agregats,
        private OrganizationDirectory $organisations,
    ) {}

    public function visible(string $userId, string $accessId): OwnerVisibleData
    {
        if (! Str::isUuid($accessId)) {
            throw ErrorCode::OwnerAccessNotFound->problem();
        }

        foreach ($this->mandats->ownerScope($userId)->visibles as $visible) {
            if ($visible->accessId === $accessId) {
                return $visible;
            }
        }

        throw ErrorCode::OwnerAccessNotFound->problem();
    }

    /**
     * À appeler dans le contexte de l'organisation. Un co-indivisaire n'écrit jamais ; pendant la grâce, seul un compte
     * mandant non soldé reste payable (ADR 0031).
     */
    public function assertWritable(OwnerVisibleData $visible): void
    {
        if ($visible->inGrace && $visible->role !== OwnerAccessRole::CoOwner && $this->solde($visible->mandantPartyId) !== 0) {
            return;
        }

        $this->mandats->assertOwnerWritable($visible);
    }

    public function isWritable(OwnerVisibleData $visible): bool
    {
        try {
            $this->assertWritable($visible);
        } catch (ApiProblem) {
            return false;
        }

        return true;
    }

    private function solde(string $mandantId): int
    {
        $fonds = $this->agregats->ownerFunds([$mandantId], $this->organisations->currency(), CarbonImmutable::today())[$mandantId] ?? null;

        return $fonds === null ? 0 : (int) $fonds->payable->getAmount();
    }
}
