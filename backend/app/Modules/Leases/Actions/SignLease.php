<?php

declare(strict_types=1);

namespace App\Modules\Leases\Actions;

use App\Modules\Catalog\Enums\LeaseComponentSemantic;
use App\Modules\Catalog\Enums\VocabularyKey;
use App\Modules\Catalog\PublicApi\TermDirectory;
use App\Modules\Documents\PublicApi\DocumentStore;
use App\Modules\Leases\Data\SignLeaseData;
use App\Modules\Leases\Enums\ErrorCode;
use App\Modules\Leases\Enums\LeasePartyRole;
use App\Modules\Leases\Enums\LeaseStatus;
use App\Modules\Leases\Events\LeaseSigned;
use App\Modules\Leases\Jurisdictions\JurisdictionDataValidator;
use App\Modules\Leases\Jurisdictions\LeaseRegimes;
use App\Modules\Leases\Models\Lease;
use App\Modules\Leases\Models\LeaseParty;
use App\Modules\Leases\Models\LeaseTerm;
use App\Modules\Leases\Models\LeaseUnit;
use App\Modules\Leases\Queries\Leases;
use App\Modules\Leases\Queries\UnitOccupations;
use App\Modules\Leases\Support\UnitOccupancyLock;
use App\Modules\Parties\PublicApi\PartyDirectory;
use App\Modules\Properties\PublicApi\UnitDirectory;
use App\Shared\Audit\RecordAudit;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;

final readonly class SignLease
{
    public function __construct(
        private Leases $baux,
        private UnitOccupancyLock $verrou,
        private UnitOccupations $occupations,
        private UnitDirectory $lots,
        private PartyDirectory $parties,
        private TermDirectory $termes,
        private DocumentStore $documents,
        private LeaseRegimes $regimes,
        private JurisdictionDataValidator $validateur,
        private RecordAudit $audit,
    ) {}

    /**
     * Aucune lecture non verrouillante avant le verrou des lots : sous REPEATABLE READ elle figerait l'instantané et le
     * second de deux baux qui visent le même lot ne verrait pas le premier. Bail et lignes de lots se lisent donc
     * `FOR UPDATE` ; tout le reste (parties, composantes, occupations) se lit après.
     */
    public function handle(Lease $lease, SignLeaseData $donnees): Lease
    {
        if ($donnees->signedOn > CarbonImmutable::today()->toDateString()) {
            throw ErrorCode::LeaseSignatureInvalid->problem('La date de signature ne peut pas être dans le futur.');
        }

        if ($donnees->signedFileId !== null && ! $this->documents->exists($donnees->signedFileId)) {
            throw ErrorCode::LeaseSignatureInvalid->problem('Le fichier signé est introuvable dans votre organisation.');
        }

        return DB::transaction(function () use ($lease, $donnees): Lease {
            $bail = $this->baux->locked($lease->id);

            if ($bail->status !== LeaseStatus::Draft) {
                throw ErrorCode::LeaseNotDraft->problem();
            }

            if ($bail->archived_at !== null) {
                throw ErrorCode::LeaseArchived->problem();
            }

            if ($bail->lock_version !== $donnees->lockVersion) {
                throw ErrorCode::LeaseStaleVersion->problem();
            }

            $lignes = array_values($bail->units()->orderBy('valid_from')->orderBy('id')->lockForUpdate()->get()->all());

            $this->verrou->acquire(array_map(fn (LeaseUnit $l): string => $l->unit_id, $lignes));

            $parties = array_values($bail->parties()->orderBy('valid_from')->orderBy('id')->get()->all());

            $this->assertComplete($bail, $lignes, $parties);
            $this->assertAvailable($lignes, $parties);
            $this->validateur->validate($this->regimes->for($bail->jurisdiction, $bail->regime_key), $bail->jurisdiction_data);

            $bail->setAttribute('ends_on', $bail->tacit_renewal ? null : $bail->starts_on->addMonthsNoOverflow($bail->duration_months)->toDateString());
            $this->assertFree($bail, $lignes);

            $bail->status = LeaseStatus::Signed;
            $bail->setAttribute('signed_on', $donnees->signedOn);
            $bail->signed_file_id = $donnees->signedFileId;
            $bail->lock_version = $bail->lock_version + 1;
            $bail->save();

            $this->audit->handle('leases.lease.signed', subject: $bail, metadata: [
                'signed_on' => $donnees->signedOn,
                'signed_file_id' => $donnees->signedFileId,
                'ends_on' => $bail->ends_on?->toDateString(),
            ]);

            LeaseSigned::dispatch($bail->id, $bail->organization_id);

            return $bail;
        });
    }

    /**
     * @param  list<LeaseUnit>  $lignes
     * @param  list<LeaseParty>  $parties
     */
    private function assertComplete(Lease $bail, array $lignes, array $parties): void
    {
        if (array_filter($lignes, fn (LeaseUnit $l): bool => $l->is_main && $l->valid_to === null) === []) {
            throw ErrorCode::LeaseNoMainUnit->problem();
        }

        if (array_filter($parties, fn (LeaseParty $p): bool => $p->role === LeasePartyRole::Tenant && $p->valid_to === null) === []) {
            throw ErrorCode::LeaseNoTenant->problem();
        }

        $jour = $bail->starts_on->toDateString();
        $composantes = array_values(array_unique(LeaseTerm::query()
            ->where('lease_id', $bail->id)
            ->where('valid_from', '<=', $jour)
            ->where(fn (Builder $e) => $e->whereNull('valid_to')->orWhere('valid_to', '>', $jour))
            ->get()
            ->map(fn (LeaseTerm $l): string => $l->component_term_id)
            ->all()));

        foreach ($this->termes->findMany($composantes, VocabularyKey::LeaseComponent) as $composante) {
            if ($composante->semanticKey === LeaseComponentSemantic::Rent->value) {
                return;
            }
        }

        throw ErrorCode::LeaseNoRent->problem();
    }

    /**
     * Une partie archivée n'est pas distinguée ici : la PublicApi de Parties n'expose que l'anonymisation.
     *
     * @param  list<LeaseUnit>  $lignes
     * @param  list<LeaseParty>  $parties
     */
    private function assertAvailable(array $lignes, array $parties): void
    {
        $ouvertes = array_filter($lignes, fn (LeaseUnit $l): bool => $l->valid_to === null);

        foreach ($this->lots->findMany(array_values(array_unique(array_map(fn (LeaseUnit $l): string => $l->unit_id, $ouvertes)))) as $lot) {
            if ($lot->isArchived) {
                throw ErrorCode::LeaseUnitNotAvailable->problem();
            }
        }

        $ouvertes = array_values(array_unique(array_map(fn (LeaseParty $p): string => $p->party_id, array_filter($parties, fn (LeaseParty $p): bool => $p->valid_to === null))));

        foreach ($this->parties->findMany($ouvertes) as $partie) {
            if ($partie->isAnonymized) {
                throw ErrorCode::LeasePartyNotAvailable->problem();
            }
        }
    }

    /**
     * @param  list<LeaseUnit>  $lignes
     */
    private function assertFree(Lease $bail, array $lignes): void
    {
        $existantes = $this->occupations->of(array_map(fn (LeaseUnit $l): string => $l->unit_id, $lignes), $bail->id);

        foreach ($lignes as $ligne) {
            $periode = $this->occupations->period($ligne->valid_from->toDateString(), $ligne->valid_to?->toDateString(), $bail);

            if ($periode === null) {
                continue;
            }

            foreach ($existantes as $autre) {
                if ($autre['unit_id'] === $ligne->unit_id && $this->occupations->overlap($periode['from'], $periode['to'], $autre['from'], $autre['to'])) {
                    throw ErrorCode::LeaseOverlap->problem();
                }
            }
        }
    }
}
