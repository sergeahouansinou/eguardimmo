<?php

declare(strict_types=1);

namespace App\Modules\Leases\Actions;

use App\Modules\Catalog\Data\TermData;
use App\Modules\Catalog\Enums\ErrorCode as CatalogErrorCode;
use App\Modules\Catalog\Enums\LeaseComponentSemantic;
use App\Modules\Catalog\Enums\VocabularyKey;
use App\Modules\Catalog\PublicApi\TermDirectory;
use App\Modules\Leases\Data\TermRevisionData;
use App\Modules\Leases\Enums\ErrorCode;
use App\Modules\Leases\Enums\LeaseStatus;
use App\Modules\Leases\Enums\TermChangeReason;
use App\Modules\Leases\Events\LeaseTermsRevised;
use App\Modules\Leases\Jurisdictions\LeaseRegimes;
use App\Modules\Leases\Models\Lease;
use App\Modules\Leases\Models\LeaseTerm;
use App\Modules\Leases\Queries\Leases;
use App\Shared\Audit\RecordAudit;
use App\Shared\Http\ApiProblem;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use LogicException;
use Money\Currency;
use Money\Money;

final readonly class ReviseLeaseTerms
{
    public function __construct(
        private Leases $baux,
        private LeaseRegimes $regimes,
        private TermDirectory $termes,
        private RecordAudit $audit,
    ) {}

    /**
     * Le verrou du bail sérialise les écritures de composantes : les lignes sont relues après l'avoir pris, jamais avant.
     * Chaque ligne en vigueur à la date d'effet est fermée à cette date et remplacée ; les lignes passées ne bougent pas.
     *
     * @return list<LeaseTerm> les lignes ouvertes
     */
    public function handle(Lease $lease, TermRevisionData $donnees, ?string $actorId): array
    {
        return DB::transaction(function () use ($lease, $donnees, $actorId): array {
            $bail = $this->baux->locked($lease->id);

            if ($bail->lock_version !== $donnees->leaseVersion) {
                throw ErrorCode::LeaseStaleVersion->problem();
            }

            $this->verifierEtat($bail);
            $this->verifierDate($bail, $donnees->effectiveOn);

            $ids = array_column($donnees->changes, 'component_term_id');

            if ($ids === [] || count($ids) !== count(array_unique($ids))) {
                throw ErrorCode::LeaseComponentInvalid->problem('Chaque composante ne peut figurer qu\'une fois dans une révision.');
            }

            $lignes = LeaseTerm::query()->where('lease_id', $bail->id)->whereIn('component_term_id', $ids)->get()->groupBy('component_term_id');
            $referentiel = $this->referentiel($ids);

            if ($donnees->reason === TermChangeReason::Revision) {
                $this->verifierRegime($bail, $donnees->effectiveOn);
            }

            $ouvertes = [];

            foreach ($donnees->changes as $changement) {
                if ($changement['close'] && $donnees->reason === TermChangeReason::Revision) {
                    throw ErrorCode::LeaseComponentInvalid->problem('Une révision porte un nouveau montant ; une suppression se fait par avenant, renouvellement ou correction.');
                }

                $montant = $changement['close'] ? null : ($changement['amount'] ?? throw ErrorCode::LeaseComponentInvalid->problem('Le nouveau montant est obligatoire.'));

                $this->verifierComposante($referentiel[$changement['component_term_id']]);

                $composante = $lignes->get($changement['component_term_id'], collect());
                $courante = $this->enVigueur($composante, $donnees->effectiveOn)
                    ?? throw ErrorCode::LeaseTermNotFound->problem();

                if ($courante->valid_from->toDateString() === $donnees->effectiveOn) {
                    throw ErrorCode::LeaseTermOverlap->problem();
                }

                if ($donnees->reason === TermChangeReason::Revision && ! $courante->indexed) {
                    throw ErrorCode::LeaseTermNotIndexed->problem();
                }

                if ($composante->contains('replaces_id', $courante->id)) {
                    throw ErrorCode::LeaseTermOverlap->problem();
                }

                if (! $changement['close']) {
                    $this->verifierRecouvrement($composante, $courante, $donnees->effectiveOn);
                }

                $fin = $courante->valid_to;
                $courante->setAttribute('valid_to', $donnees->effectiveOn);
                $courante->save();

                if ($montant === null) {
                    continue;
                }

                $ouvertes[] = LeaseTerm::query()->create([
                    'lease_id' => $bail->id,
                    'component_term_id' => $courante->component_term_id,
                    'amount' => new Money($montant, $this->devise($bail)),
                    'vat_bp' => $changement['vat_bp'] ?? $courante->vat_bp,
                    'indexed' => $changement['indexed'] ?? $courante->indexed,
                    'valid_from' => $donnees->effectiveOn,
                    'valid_to' => $fin,
                    'reason' => $donnees->reason,
                    'replaces_id' => $courante->id,
                    'created_by_user_id' => $actorId,
                ]);
            }

            $this->verifierLoyer($bail, $donnees, $referentiel);

            $bail->lock_version++;
            $bail->save();

            $this->audit->handle('leases.terms.revised', $actorId, [
                'effective_on' => $donnees->effectiveOn,
                'reason' => $donnees->reason->value,
                'components' => $ids,
                'closed' => count($donnees->changes) - count($ouvertes),
                'opened' => count($ouvertes),
            ], $bail);

            LeaseTermsRevised::dispatch($bail->id, $bail->organization_id, $donnees->effectiveOn);

            return $ouvertes;
        });
    }

    private function devise(Lease $bail): Currency
    {
        return $bail->currency !== '' ? new Currency($bail->currency) : throw new LogicException('Devise du bail absente.');
    }

    private function verifierEtat(Lease $bail): void
    {
        if ($bail->archived_at !== null) {
            throw ErrorCode::LeaseArchived->problem();
        }

        match ($bail->status) {
            LeaseStatus::Signed => null,
            LeaseStatus::Draft => throw ErrorCode::LeaseNotSigned->problem(),
            LeaseStatus::Terminated, LeaseStatus::Cancelled => throw ErrorCode::LeaseAlreadyTerminated->problem(),
        };
    }

    private function verifierDate(Lease $bail, string $effet): void
    {
        $fin = $bail->effectiveEnd();

        if ($effet < $bail->starts_on->toDateString() || ($fin !== null && $effet >= $fin)) {
            throw ErrorCode::LeasePeriodInvalid->problem('La date d\'effet doit tomber pendant le bail : à partir de son début et avant sa fin.');
        }
    }

    private function verifierRegime(Lease $bail, string $effet): void
    {
        $regime = $this->regimes->for($bail->jurisdiction, $bail->regime_key);

        $derniere = LeaseTerm::query()
            ->where('lease_id', $bail->id)
            ->where('reason', TermChangeReason::Revision->value)
            ->max('valid_from');

        $prochaine = $regime->nextRevisionDate(
            CarbonImmutable::parse($bail->starts_on->toDateString()),
            is_string($derniere) ? CarbonImmutable::parse($derniere) : null,
            $bail->jurisdiction_data,
        );

        if ($prochaine === null) {
            throw ErrorCode::LeaseRevisionNotAllowed->problem();
        }

        if ($effet < $prochaine->toDateString()) {
            throw ErrorCode::LeaseRevisionTooEarly->problem('La révision ne peut pas prendre effet avant le '.$prochaine->toDateString().'.');
        }
    }

    /**
     * @param  list<string>  $ids
     * @return array<string, TermData>
     */
    private function referentiel(array $ids): array
    {
        try {
            return $this->termes->findMany($ids, VocabularyKey::LeaseComponent);
        } catch (ApiProblem $probleme) {
            throw $probleme->problemCode === CatalogErrorCode::TermNotFound->value ? ErrorCode::LeaseComponentInvalid->problem() : $probleme;
        }
    }

    /**
     * Un bail signé ne reste jamais sans loyer : fermer la ligne de loyer exige qu'une autre ligne de loyer soit en vigueur à la date d'effet.
     *
     * @param  array<string, TermData>  $referentiel
     */
    private function verifierLoyer(Lease $bail, TermRevisionData $donnees, array $referentiel): void
    {
        $fermeLoyer = false;

        foreach ($donnees->changes as $changement) {
            $fermeLoyer = $fermeLoyer || ($changement['close'] && $referentiel[$changement['component_term_id']]->semanticKey === LeaseComponentSemantic::Rent->value);
        }

        if (! $fermeLoyer) {
            return;
        }

        $enVigueur = array_values(array_unique(LeaseTerm::query()
            ->where('lease_id', $bail->id)
            ->where('valid_from', '<=', $donnees->effectiveOn)
            ->where(fn (Builder $e) => $e->whereNull('valid_to')->orWhere('valid_to', '>', $donnees->effectiveOn))
            ->get()
            ->map(fn (LeaseTerm $l): string => $l->component_term_id)
            ->all()));

        foreach ($this->termes->findMany($enVigueur, VocabularyKey::LeaseComponent) as $composante) {
            if ($composante->semanticKey === LeaseComponentSemantic::Rent->value) {
                return;
            }
        }

        throw ErrorCode::LeaseNoRent->problem('Le loyer ne peut pas être supprimé sans être remplacé : un bail signé garde une ligne de loyer en vigueur.');
    }

    private function verifierComposante(TermData $composante): void
    {
        if (LeaseComponentSemantic::tryFrom((string) $composante->semanticKey) === LeaseComponentSemantic::Deposit) {
            throw ErrorCode::LeaseDepositLocked->problem();
        }
    }

    /**
     * @param  iterable<LeaseTerm>  $lignes
     */
    private function enVigueur(iterable $lignes, string $jour): ?LeaseTerm
    {
        foreach ($lignes as $ligne) {
            if ($ligne->valid_from->toDateString() <= $jour && ($ligne->valid_to === null || $ligne->valid_to->toDateString() > $jour)) {
                return $ligne;
            }
        }

        return null;
    }

    /**
     * La nouvelle ligne garde la fin de celle qu'elle remplace : toute autre ligne de la composante qui la recoupe est un conflit.
     *
     * @param  iterable<LeaseTerm>  $lignes
     */
    private function verifierRecouvrement(iterable $lignes, LeaseTerm $courante, string $effet): void
    {
        $fin = $courante->valid_to?->toDateString();

        foreach ($lignes as $ligne) {
            if ($ligne->id === $courante->id) {
                continue;
            }

            $finLigne = $ligne->valid_to?->toDateString();

            if (($finLigne === null || $finLigne > $effet) && ($fin === null || $ligne->valid_from->toDateString() < $fin)) {
                throw ErrorCode::LeaseTermOverlap->problem();
            }
        }
    }
}
