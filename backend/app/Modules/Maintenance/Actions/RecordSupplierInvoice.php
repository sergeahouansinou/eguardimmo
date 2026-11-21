<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Actions;

use App\Modules\Accounting\PublicApi\Ledger;
use App\Modules\Documents\PublicApi\DocumentStore;
use App\Modules\Maintenance\Data\SupplierInvoiceInputData;
use App\Modules\Maintenance\Enums\ActorKind;
use App\Modules\Maintenance\Enums\ErrorCode;
use App\Modules\Maintenance\Enums\EventKind;
use App\Modules\Maintenance\Enums\FileKind;
use App\Modules\Maintenance\Enums\InterventionStatus;
use App\Modules\Maintenance\Enums\SupplierInvoiceStatus;
use App\Modules\Maintenance\Models\SupplierInvoice;
use App\Modules\Maintenance\Models\SupplierInvoiceTax;
use App\Modules\Maintenance\Support\Attachments;
use App\Modules\Maintenance\Support\Committed;
use App\Modules\Maintenance\Support\Currencies;
use App\Modules\Maintenance\Support\InvoiceTaxes;
use App\Modules\Maintenance\Support\Locks;
use App\Modules\Maintenance\Support\Postings;
use App\Modules\Maintenance\Support\Timeline;
use App\Modules\Maintenance\Support\Transitions;
use App\Modules\Parties\PublicApi\PartyDirectory;
use App\Shared\Audit\RecordAudit;
use Carbon\CarbonImmutable;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Money\Money;

final readonly class RecordSupplierInvoice
{
    public function __construct(
        private Locks $verrous,
        private Transitions $transitions,
        private Attachments $pieces,
        private DocumentStore $documents,
        private InvoiceTaxes $taxes,
        private Committed $engage,
        private PartyDirectory $parties,
        private Postings $ecritures,
        private Ledger $livre,
        private Timeline $chronologie,
        private RecordAudit $audit,
    ) {}

    /**
     * Facture reçue, saisie telle qu'imprimée sur le PDF : écriture « Travaux à imputer / Fournisseurs » dans la même transaction.
     * Au-dessus du montant engagé elle s'enregistre mais ne s'impute pas avant un avenant. Rejouable par clé d'idempotence ; un
     * doublon (numéro du prestataire ou empreinte du PDF) est refusé en 409.
     *
     * @return array{invoice: SupplierInvoice, replayed: bool}
     */
    public function handle(string $interventionId, SupplierInvoiceInputData $donnees): array
    {
        try {
            return DB::transaction(function () use ($interventionId, $donnees): array {
                $intervention = $this->verrous->intervention($interventionId);
                $rejeu = SupplierInvoice::query()->where('idempotency_key', $donnees->idempotencyKey)->first();

                if ($rejeu !== null) {
                    return ['invoice' => $this->replay($rejeu, $intervention->id, $donnees), 'replayed' => true];
                }

                return ['invoice' => $this->record($interventionId, $donnees), 'replayed' => false];
            });
        } catch (UniqueConstraintViolationException $erreur) {
            $rejeu = SupplierInvoice::query()->where('idempotency_key', $donnees->idempotencyKey)->first();

            if ($rejeu !== null) {
                return ['invoice' => $this->replay($rejeu, $interventionId, $donnees), 'replayed' => true];
            }

            throw ErrorCode::SupplierInvoiceDuplicate->problem();
        }
    }

    private function record(string $interventionId, SupplierInvoiceInputData $donnees): SupplierInvoice
    {
        $intervention = $this->verrous->intervention($interventionId);
        $this->transitions->assertIn($intervention, InterventionStatus::Completed, InterventionStatus::Invoiced);

        if ($intervention->supplier_party_id === null) {
            throw ErrorCode::SupplierRequired->problem();
        }

        $jour = CarbonImmutable::parse($donnees->invoiceOn);

        if ($jour->greaterThan(CarbonImmutable::today())) {
            throw ErrorCode::InvoiceTotalsInvalid->problem('La date de facture ne peut pas être future.');
        }

        $groupes = $this->taxes->check($donnees->taxes, $jour);
        $net = array_sum(array_map(fn ($g): int => $g->base, $groupes));
        $taxe = array_sum(array_map(fn ($g): int => $g->tax, $groupes));
        $brut = $net + $taxe;

        if ($brut <= 0 || ($donnees->declaredGross !== null && $donnees->declaredGross !== $brut)) {
            throw ErrorCode::InvoiceTotalsInvalid->problem();
        }

        $fichier = $this->pieces->resolve($donnees->fileId, $intervention->id, FileKind::Invoice);
        $stocke = $this->documents->find($fichier->stored_file_id) ?? throw ErrorCode::FileNotFound->problem();

        if (SupplierInvoice::query()->where('supplier_party_id', $intervention->supplier_party_id)->where('number', $donnees->number)->exists()
            || SupplierInvoice::query()->where('fingerprint', $stocke->sha256)->exists()) {
            throw ErrorCode::SupplierInvoiceDuplicate->problem();
        }

        $identite = $this->parties->invoiceIdentity($intervention->supplier_party_id);
        $monnaie = Currencies::of($intervention->currency);
        $engage = $this->engage->amount($intervention);
        $id = (string) Str::uuid7();

        $facture = new SupplierInvoice;
        $facture->forceFill([
            'id' => $id,
            'intervention_id' => $intervention->id,
            'supplier_party_id' => $intervention->supplier_party_id,
            'billed_party_id' => $intervention->mandant_party_id,
            'number' => $donnees->number,
            'invoice_on' => $donnees->invoiceOn,
            'due_on' => $donnees->dueOn,
            'currency' => $intervention->currency,
            'total_net' => new Money($net, $monnaie),
            'total_tax' => new Money($taxe, $monnaie),
            'total_gross' => new Money($brut, $monnaie),
            'status' => SupplierInvoiceStatus::Recorded,
            'stored_file_id' => $fichier->stored_file_id,
            'fingerprint' => $stocke->sha256,
            'snapshot' => get_object_vars($identite),
            'exceeds_approved_amount' => $engage !== null && $this->engage->invoicedGross($intervention->id) + $brut > $engage,
            'idempotency_key' => $donnees->idempotencyKey,
            'created_by_user_id' => is_string(auth()->id()) ? auth()->id() : null,
            'lock_version' => 1,
        ]);
        $facture->forceFill(['ledger_entry_id' => $this->livre->post($this->ecritures->record($facture, $intervention))->id])->save();

        foreach ($groupes as $position => $groupe) {
            SupplierInvoiceTax::query()->create([
                'supplier_invoice_id' => $facture->id,
                'position' => $position + 1,
                'category' => $groupe->category,
                'rate_pcm' => $groupe->ratePcm,
                'base_amount' => $groupe->base,
                'tax_amount' => $groupe->tax,
            ]);
        }

        if ($intervention->status === InterventionStatus::Completed) {
            $this->transitions->apply($intervention, InterventionStatus::Invoiced);
        }

        $this->chronologie->add($intervention, EventKind::Invoiced, ActorKind::Team, 'Facture reçue enregistrée.', metadata: ['invoice_id' => $facture->id]);
        $this->audit->handle('maintenance.invoice.recorded', subject: $facture, metadata: ['intervention_id' => $intervention->id, 'total_gross' => $facture->total_gross, 'exceeds_approved_amount' => $facture->exceeds_approved_amount]);

        return $facture;
    }

    private function replay(SupplierInvoice $existante, string $interventionId, SupplierInvoiceInputData $donnees): SupplierInvoice
    {
        $existante->loadMissing('taxes');
        $groupes = $this->taxes->check($donnees->taxes, CarbonImmutable::parse($donnees->invoiceOn));
        $fichier = $this->pieces->resolve($donnees->fileId, $interventionId, FileKind::Invoice);
        $attendu = array_map(fn ($g): array => [$g->category->value, $g->ratePcm, $g->base, $g->tax], $groupes);
        $enregistre = $existante->taxes->sortBy('position')->map(fn ($t): array => [$t->category->value, $t->rate_pcm, $t->base_amount, $t->tax_amount])->values()->all();

        if ($existante->intervention_id !== $interventionId || $existante->number !== $donnees->number
            || $existante->invoice_on->toDateString() !== $donnees->invoiceOn || $existante->due_on?->toDateString() !== $donnees->dueOn
            || $existante->stored_file_id !== $fichier->stored_file_id || $attendu !== $enregistre) {
            throw ErrorCode::IdempotencyKeyReused->problem();
        }

        return $existante;
    }
}
