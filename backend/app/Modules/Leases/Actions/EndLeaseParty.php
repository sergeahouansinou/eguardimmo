<?php

declare(strict_types=1);

namespace App\Modules\Leases\Actions;

use App\Modules\Leases\Data\EndLeasePartyData;
use App\Modules\Leases\Enums\ErrorCode;
use App\Modules\Leases\Enums\LeasePartyRole;
use App\Modules\Leases\Enums\LeaseStatus;
use App\Modules\Leases\Events\LeaseTenantLeft;
use App\Modules\Leases\Models\Lease;
use App\Modules\Leases\Models\LeaseParty;
use App\Modules\Leases\Queries\Leases;
use App\Shared\Audit\RecordAudit;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;

final readonly class EndLeaseParty
{
    public function __construct(
        private Leases $baux,
        private RecordAudit $audit,
    ) {}

    /**
     * Les lignes du bail se relisent après son verrou, jamais avant : deux départs concurrents se sérialisent dessus
     * et le second voit le premier, sans quoi le bail pourrait perdre son dernier locataire.
     * Les garanties propres au locataire qui part sont closes à la même date ; les lignes passées ne bougent pas.
     */
    public function handle(Lease $lease, string $leasePartyId, EndLeasePartyData $donnees): LeaseParty
    {
        return DB::transaction(function () use ($lease, $leasePartyId, $donnees): LeaseParty {
            $bail = $this->baux->locked($lease->id);

            $this->verifierEtat($bail, $donnees->lockVersion);

            $lignes = LeaseParty::query()->where('lease_id', $bail->id)->get();
            $ligne = $lignes->firstWhere('id', $leasePartyId) ?? throw ErrorCode::LeasePartyNotFound->problem();

            $fin = $donnees->validTo;

            $this->verifierDate($bail, $ligne, $fin);

            if ($ligne->role === LeasePartyRole::Tenant && ! $this->resteUnLocataire($lignes, $ligne, $fin)) {
                throw ErrorCode::LeaseLastTenant->problem();
            }

            $garanties = $ligne->role === LeasePartyRole::Tenant ? $this->garanties($lignes, $ligne, $fin) : [];

            foreach ($garanties as $garantie) {
                $garantie->setAttribute('valid_to', $fin);
                $garantie->save();
            }

            $ligne->setAttribute('valid_to', $fin);
            $ligne->save();

            $bail->lock_version = $bail->lock_version + 1;
            $bail->save();

            $this->audit->handle('leases.party.ended', subject: $bail, metadata: [
                'lease_party_id' => $ligne->id,
                'party_id' => $ligne->party_id,
                'role' => $ligne->role->value,
                'valid_to' => $fin,
                'guarantees_closed' => array_map(fn (LeaseParty $g): string => $g->id, $garanties),
            ]);

            if ($ligne->role === LeasePartyRole::Tenant) {
                LeaseTenantLeft::dispatch($bail->id, $bail->organization_id, $ligne->party_id, $fin);
            }

            return $ligne;
        });
    }

    private function verifierEtat(Lease $bail, int $version): void
    {
        if ($bail->lock_version !== $version) {
            throw ErrorCode::LeaseStaleVersion->problem();
        }

        if ($bail->archived_at !== null) {
            throw ErrorCode::LeaseArchived->problem();
        }

        match ($bail->status) {
            LeaseStatus::Draft, LeaseStatus::Signed => null,
            LeaseStatus::Terminated, LeaseStatus::Cancelled => throw ErrorCode::LeaseAlreadyTerminated->problem(),
        };
    }

    private function verifierDate(Lease $bail, LeaseParty $ligne, string $fin): void
    {
        if ($ligne->valid_to !== null) {
            throw ErrorCode::LeasePeriodInvalid->problem('Cette partie a déjà quitté le bail.');
        }

        $fins = $bail->effectiveEnd();

        if ($fin <= $ligne->valid_from->toDateString() || ($fins !== null && $fin > $fins)) {
            throw ErrorCode::LeasePeriodInvalid->problem('La date de départ doit suivre l\'entrée de la partie et ne pas dépasser la fin du bail.');
        }
    }

    /**
     * Un autre locataire sans date de fin, présent à la date de départ : le bail n'a ensuite aucun jour sans locataire.
     *
     * @param  Collection<int, LeaseParty>  $lignes
     */
    private function resteUnLocataire(Collection $lignes, LeaseParty $ligne, string $fin): bool
    {
        return $lignes->contains(fn (LeaseParty $l): bool => $l->id !== $ligne->id
            && $l->role === LeasePartyRole::Tenant
            && $l->valid_to === null
            && $l->valid_from->toDateString() <= $fin);
    }

    /**
     * @param  Collection<int, LeaseParty>  $lignes
     * @return list<LeaseParty>
     */
    private function garanties(Collection $lignes, LeaseParty $ligne, string $fin): array
    {
        $ouvertes = $lignes->filter(fn (LeaseParty $l): bool => $l->role === LeasePartyRole::Guarantor
            && $l->guarantees_party_id === $ligne->party_id
            && ($l->valid_to === null || $l->valid_to->toDateString() > $fin));

        foreach ($ouvertes as $garantie) {
            if ($garantie->valid_from->toDateString() >= $fin) {
                throw ErrorCode::LeasePeriodInvalid->problem('Une caution de ce locataire commence à cette date ou après : fermez-la d\'abord.');
            }
        }

        return array_values($ouvertes->all());
    }
}
