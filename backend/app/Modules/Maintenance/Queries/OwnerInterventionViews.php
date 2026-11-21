<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Queries;

use App\Modules\Catalog\Enums\VocabularyKey;
use App\Modules\Catalog\PublicApi\TermDirectory;
use App\Modules\Documents\PublicApi\DocumentStore;
use App\Modules\Maintenance\Enums\AllocationTarget;
use App\Modules\Maintenance\Enums\QuoteStatus;
use App\Modules\Maintenance\Enums\SupplierInvoiceStatus;
use App\Modules\Maintenance\Enums\VisitStatus;
use App\Modules\Maintenance\Models\Intervention;
use App\Modules\Maintenance\Models\InterventionApproval;
use App\Modules\Maintenance\Models\InterventionEvent;
use App\Modules\Maintenance\Models\InterventionFile;
use App\Modules\Maintenance\Models\InterventionQuote;
use App\Modules\Maintenance\Models\InterventionVisit;
use App\Modules\Maintenance\Models\InvoiceAllocation;
use App\Modules\Maintenance\Models\SupplierInvoice;
use App\Modules\Parties\PublicApi\PartyDirectory;
use App\Modules\Properties\PublicApi\UnitDirectory;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Support\Collection;

/**
 * Lectures du mandant sous le contexte de l'organisation de chaque intervention, en nombre de requêtes constant par organisation.
 */
final readonly class OwnerInterventionViews
{
    public function __construct(
        private CurrentOrganization $contexte,
        private TermDirectory $termes,
        private UnitDirectory $lots,
        private PartyDirectory $parties,
        private DocumentStore $fichiers,
    ) {}

    /**
     * @param  iterable<Intervention>  $interventions
     * @return array<string, OwnerView> par identifiant d'intervention
     */
    public function build(iterable $interventions, bool $detail): array
    {
        $parOrganisation = [];

        foreach ($interventions as $intervention) {
            $parOrganisation[$intervention->organization_id][] = $intervention;
        }

        $vues = [];

        foreach ($parOrganisation as $organisation => $groupe) {
            $vues += $this->contexte->run($organisation, fn (): array => $this->forOrganization($groupe, $detail));
        }

        return $vues;
    }

    /**
     * @param  list<Intervention>  $groupe
     * @return array<string, OwnerView>
     */
    private function forOrganization(array $groupe, bool $detail): array
    {
        $ids = array_map(fn (Intervention $i): string => $i->id, $groupe);
        $natures = $this->termes->findMany(array_values(array_unique(array_map(fn (Intervention $i): string => $i->nature_term_id, $groupe))), VocabularyKey::InterventionNature);
        $lotIds = array_values(array_unique(array_filter(array_map(fn (Intervention $i): ?string => $i->unit_id, $groupe))));
        $lots = $lotIds === [] ? [] : $this->lots->findMany($lotIds);
        $prestataireIds = array_values(array_unique(array_filter(array_map(fn (Intervention $i): ?string => $i->supplier_party_id, $groupe))));
        $prestataires = $prestataireIds === [] ? [] : $this->parties->findMany($prestataireIds);

        $visites = $detail ? InterventionVisit::query()->whereIn('intervention_id', $ids)->where('status', '<>', VisitStatus::Cancelled->value)->orderBy('scheduled_on')->orderBy('id')->get()->groupBy('intervention_id') : collect();
        $evenements = $detail ? InterventionEvent::query()->whereIn('intervention_id', $ids)->where('visible_to_owner', true)->orderBy('created_at')->orderBy('id')->get()->groupBy('intervention_id') : collect();
        $fichiers = $detail ? InterventionFile::query()->whereIn('intervention_id', $ids)->where('visible_to_owner', true)->orderBy('created_at')->orderBy('id')->get()->groupBy('intervention_id') : collect();
        $noms = $detail ? $this->noms($fichiers) : [];
        $approbations = $detail ? InterventionApproval::query()->whereIn('intervention_id', $ids)->orderBy('requested_at')->orderBy('id')->get()->groupBy('intervention_id') : collect();
        $devis = $detail ? $this->devis($ids, $approbations) : collect();
        $factures = $detail ? SupplierInvoice::query()->whereIn('intervention_id', $ids)->where('status', '<>', SupplierInvoiceStatus::Cancelled->value)->orderBy('invoice_on')->orderBy('id')->get()->groupBy('intervention_id') : collect();
        $imputations = $detail ? $this->imputations($ids) : collect();

        $vues = [];

        foreach ($groupe as $intervention) {
            $lot = $intervention->unit_id === null ? null : ($lots[$intervention->unit_id] ?? null);
            $nature = $natures[$intervention->nature_term_id] ?? null;
            $prestataire = $intervention->supplier_party_id === null ? null : ($prestataires[$intervention->supplier_party_id] ?? null);
            $mandant = $intervention->mandant_party_id;
            $mesFactures = array_values(($factures[$intervention->id] ?? collect())->filter(fn (SupplierInvoice $f): bool => $f->billed_party_id === $mandant)->all());
            $facturesIds = array_map(fn (SupplierInvoice $f): string => $f->id, $mesFactures);
            $vues[$intervention->id] = new OwnerView(
                $nature?->key,
                $nature === null ? null : (string) ($nature->labels['fr'] ?? $nature->key),
                $lot?->propertyName,
                $lot?->reference,
                $prestataire?->displayName,
                array_values(($visites[$intervention->id] ?? collect())->all()),
                array_values(($evenements[$intervention->id] ?? collect())->all()),
                array_values(($fichiers[$intervention->id] ?? collect())->all()),
                $noms,
                array_values(($devis[$intervention->id] ?? collect())->all()),
                array_values(($approbations[$intervention->id] ?? collect())->all()),
                $mesFactures,
                array_values(($imputations[$intervention->id] ?? collect())->filter(fn (InvoiceAllocation $a): bool => in_array($a->supplier_invoice_id, $facturesIds, true))->all()),
            );
        }

        return $vues;
    }

    /**
     * @param  Collection<string, Collection<int, InterventionFile>>  $fichiers
     * @return array<string, string>
     */
    private function noms(Collection $fichiers): array
    {
        $fichiersIds = array_values($fichiers->flatten(1)->map(fn (InterventionFile $f): string => $f->stored_file_id)->unique()->all());
        $decrits = $fichiersIds === [] ? [] : $this->fichiers->findMany($fichiersIds);
        $noms = [];

        foreach ($fichiers->flatten(1) as $f) {
            $noms[$f->id] = isset($decrits[$f->stored_file_id]) ? $decrits[$f->stored_file_id]->displayName : 'Document';
        }

        return $noms;
    }

    /**
     * Devis soumis au mandant : un devis seulement reçu par l'équipe n'est pas encore le sien.
     *
     * @param  list<string>  $ids
     * @param  Collection<string, Collection<int, InterventionApproval>>  $approbations
     * @return Collection<array-key, Collection<int, InterventionQuote>>
     */
    private function devis(array $ids, Collection $approbations): Collection
    {
        $demandes = $approbations->flatten(1)->map(fn (InterventionApproval $a): ?string => $a->quote_id)->filter()->values()->all();

        return InterventionQuote::query()->whereIn('intervention_id', $ids)
            ->where(fn ($q) => $q->whereIn('status', [QuoteStatus::Submitted->value, QuoteStatus::Accepted->value, QuoteStatus::Refused->value, QuoteStatus::Expired->value])->orWhereIn('id', $demandes))
            ->with('lines')->orderBy('issued_on')->orderBy('id')->get()->toBase()->groupBy('intervention_id');
    }

    /**
     * @param  list<string>  $ids
     * @return Collection<array-key, Collection<int, InvoiceAllocation>>
     */
    private function imputations(array $ids): Collection
    {
        return InvoiceAllocation::query()->whereIn('intervention_id', $ids)->where('target', AllocationTarget::Owner->value)->whereNull('cancelled_at')->orderBy('created_at')->orderBy('id')->get()->toBase()->groupBy('intervention_id');
    }
}
