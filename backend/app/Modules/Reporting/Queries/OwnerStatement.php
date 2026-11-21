<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Queries;

use App\Modules\Accounting\Data\PartyStatementData;
use App\Modules\Accounting\Enums\AccountRole;
use App\Modules\Accounting\PublicApi\LedgerAggregates;
use App\Modules\Mandates\Data\OwnerVisibleData;
use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Shared\Audit\RecordAudit;
use App\Shared\Tenancy\CurrentOrganization;
use Carbon\CarbonImmutable;

/**
 * Relevé du compte « fonds du mandant » du couple (agence, mandant) de la clé, lu dans l'organisation de l'agence et dans sa devise.
 * La clé vient de `OwnerSelection`, jamais d'un identifiant du client.
 */
final readonly class OwnerStatement
{
    public function __construct(
        private CurrentOrganization $contexte,
        private OrganizationDirectory $organisations,
        private LedgerAggregates $grandLivre,
        private RecordAudit $audit,
    ) {}

    /**
     * @return array{statement: PartyStatementData, party_id: string, name: string, currency: string}
     */
    public function of(OwnerVisibleData $visible, CarbonImmutable $from, CarbonImmutable $to, string $format): array
    {
        return $this->contexte->run($visible->organizationId, function () use ($visible, $from, $to, $format): array {
            $devise = $this->organisations->currency();
            $releve = $this->grandLivre->partyStatement($visible->mandantPartyId, AccountRole::OwnerPayable, $devise, $from, $to);
            $this->audit->handle('reporting.owner_statement.viewed', metadata: ['mandant_party_id' => $visible->mandantPartyId, 'from' => $from->toDateString(), 'to' => $to->toDateString(), 'format' => $format]);

            return ['statement' => $releve, 'party_id' => $visible->mandantPartyId, 'name' => $visible->mandantName, 'currency' => $devise->getCode()];
        });
    }
}
