<?php

declare(strict_types=1);

namespace App\Modules\Leases\Actions;

use App\Modules\Leases\Data\NewLeasePartyChangeData;
use App\Modules\Leases\Enums\ErrorCode;
use App\Modules\Leases\Enums\LeasePartyRole;
use App\Modules\Leases\Enums\LeaseStatus;
use App\Modules\Leases\Models\Lease;
use App\Modules\Leases\Models\LeaseParty;
use App\Modules\Leases\Queries\Leases;
use App\Modules\Leases\Support\DraftCurrency;
use App\Modules\Parties\PublicApi\PartyDirectory;
use App\Shared\Audit\RecordAudit;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Money\Money;

final readonly class AddLeaseParty
{
    public function __construct(
        private Leases $baux,
        private PartyDirectory $parties,
        private RecordAudit $audit,
    ) {}

    /**
     * Les lignes du bail se relisent après son verrou, jamais avant : deux ajouts concurrents se sérialisent dessus.
     */
    public function handle(Lease $lease, NewLeasePartyChangeData $donnees): LeaseParty
    {
        $this->verifierForme($donnees);

        return DB::transaction(function () use ($lease, $donnees): LeaseParty {
            $bail = $this->baux->locked($lease->id);

            $this->verifierEtat($bail, $donnees->lockVersion);

            $debut = $this->debut($bail, $donnees->validFrom);

            if ($donnees->guaranteeEndsOn !== null && $donnees->guaranteeEndsOn <= $debut) {
                throw ErrorCode::LeasePeriodInvalid->problem('La fin de la caution doit suivre le début de la partie au bail.');
            }

            if ($this->parties->find($donnees->partyId)->isAnonymized) {
                throw ErrorCode::LeasePartyNotAvailable->problem();
            }

            $lignes = LeaseParty::query()->where('lease_id', $bail->id)->get();

            $this->verifierRecouvrement($lignes, $donnees, $debut);

            $cible = $donnees->role === LeasePartyRole::Guarantor ? $this->locataireGaranti($lignes, $donnees, $debut) : null;

            $ligne = LeaseParty::query()->create([
                'lease_id' => $bail->id,
                'party_id' => $donnees->partyId,
                'role' => $donnees->role,
                'joint_liability' => $donnees->jointLiability,
                'guarantees_party_id' => $donnees->guaranteesPartyId,
                'guarantee_limit_amount' => $donnees->guaranteeLimitAmount === null ? null : new Money($donnees->guaranteeLimitAmount, DraftCurrency::of($bail)),
                'guarantee_ends_on' => $donnees->guaranteeEndsOn,
                'valid_from' => $debut,
                'valid_to' => $cible?->valid_to?->toDateString(),
            ]);

            $bail->lock_version = $bail->lock_version + 1;
            $bail->save();

            $this->audit->handle('leases.party.added', subject: $bail, metadata: [
                'lease_party_id' => $ligne->id,
                'party_id' => $ligne->party_id,
                'role' => $ligne->role->value,
                'valid_from' => $debut,
                'guarantees_party_id' => $ligne->guarantees_party_id,
            ]);

            return $ligne;
        });
    }

    private function verifierForme(NewLeasePartyChangeData $donnees): void
    {
        $garantie = $donnees->guaranteesPartyId !== null || $donnees->guaranteeLimitAmount !== null || $donnees->guaranteeEndsOn !== null;

        if ($garantie && $donnees->role !== LeasePartyRole::Guarantor) {
            throw ValidationException::withMessages(['role' => ['Seul un garant porte une caution.']]);
        }

        if ($donnees->guaranteesPartyId !== null && $donnees->guaranteesPartyId === $donnees->partyId) {
            throw ValidationException::withMessages(['guarantees_party_id' => ['Un garant ne peut pas se porter garant de lui-même.']]);
        }

        if ($donnees->guaranteeLimitAmount !== null && $donnees->guaranteeLimitAmount < 1) {
            throw ValidationException::withMessages(['guarantee_limit_amount' => ['Le plafond de la caution doit être positif.']]);
        }
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

    private function debut(Lease $bail, ?string $demande): string
    {
        $debutBail = $bail->starts_on->toDateString();
        $fin = $bail->effectiveEnd();
        $jour = $demande ?? max(CarbonImmutable::today()->toDateString(), $debutBail);

        if ($jour < $debutBail || ($fin !== null && $jour >= $fin)) {
            throw ErrorCode::LeasePeriodInvalid->problem('La date d\'entrée doit tomber pendant le bail : à partir de son début et avant sa fin.');
        }

        return $jour;
    }

    /**
     * La nouvelle ligne reste ouverte : elle recoupe toute ligne du même couple partie-rôle qui n'est pas close avant son début.
     *
     * @param  Collection<int, LeaseParty>  $lignes
     */
    private function verifierRecouvrement(Collection $lignes, NewLeasePartyChangeData $donnees, string $debut): void
    {
        foreach ($lignes as $ligne) {
            if ($ligne->party_id === $donnees->partyId && $ligne->role === $donnees->role && ($ligne->valid_to === null || $ligne->valid_to->toDateString() > $debut)) {
                throw ErrorCode::LeasePartyConflict->problem();
            }
        }
    }

    /**
     * @param  Collection<int, LeaseParty>  $lignes
     */
    private function locataireGaranti(Collection $lignes, NewLeasePartyChangeData $donnees, string $debut): ?LeaseParty
    {
        if ($donnees->guaranteesPartyId === null) {
            return null;
        }

        foreach ($lignes as $ligne) {
            if ($ligne->party_id === $donnees->guaranteesPartyId
                && $ligne->role === LeasePartyRole::Tenant
                && $ligne->valid_from->toDateString() <= $debut
                && ($ligne->valid_to === null || $ligne->valid_to->toDateString() > $debut)) {
                return $ligne;
            }
        }

        throw ErrorCode::LeasePartyNotFound->problem('Le locataire garanti n\'est pas un locataire de ce bail à cette date.');
    }
}
