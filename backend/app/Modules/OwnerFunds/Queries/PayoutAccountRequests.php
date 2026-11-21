<?php

declare(strict_types=1);

namespace App\Modules\OwnerFunds\Queries;

use App\Modules\Mandates\Data\OwnerScopeData;
use App\Modules\OwnerFunds\Enums\PayoutAccountRequestStatus;
use App\Modules\OwnerFunds\Models\PayoutAccountRequest;
use App\Shared\Tenancy\AcrossOrganizations;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Str;

/**
 * Demandes de changement de compte de paiement : celles du couple (organisation, mandant) de la clé du compte, jamais un
 * identifiant du client.
 */
final readonly class PayoutAccountRequests
{
    public function ofOwner(OwnerScopeData $portee, string $id): ?PayoutAccountRequest
    {
        return Str::isUuid($id) ? $this->visible($portee)->whereKey($id)->first() : null;
    }

    /**
     * La demande vivante, à défaut la plus récente, de chaque couple visible.
     *
     * @return array<string, PayoutAccountRequest> par organisation et mandant (`org|mandant`)
     */
    public function latestOf(OwnerScopeData $portee): array
    {
        $resultat = [];

        foreach ($this->visible($portee)->orderBy('created_at')->orderBy('id')->get() as $demande) {
            $cle = $demande->organization_id.'|'.$demande->mandant_party_id;
            $courante = $resultat[$cle] ?? null;

            if ($courante === null || $demande->status->isLive() || ! $courante->status->isLive()) {
                $resultat[$cle] = $demande;
            }
        }

        return $resultat;
    }

    /**
     * Organisations ayant au moins une demande à échéance (code périmé ou demande sans suite).
     *
     * @return list<string>
     */
    public function organizationsDue(CarbonImmutable $codeAvant, CarbonImmutable $demandeAvant): array
    {
        $ids = AcrossOrganizations::query(PayoutAccountRequest::class)
            ->where(fn (Builder $q) => $q
                ->where(fn (Builder $a) => $a->where('status', PayoutAccountRequestStatus::AwaitingCode->value)->where('created_at', '<', $codeAvant))
                ->orWhere(fn (Builder $p) => $p->where('status', PayoutAccountRequestStatus::Pending->value)->where('created_at', '<', $demandeAvant)))
            ->distinct()->pluck('organization_id');

        return array_values(array_map(fn (mixed $id): string => (string) $id, $ids->all()));
    }

    /**
     * @return Builder<PayoutAccountRequest>
     */
    private function visible(OwnerScopeData $portee): Builder
    {
        return $portee->restrictToMandants(AcrossOrganizations::query(PayoutAccountRequest::class), 'organization_id', 'mandant_party_id', ['holder', 'representative']);
    }
}
