<?php

declare(strict_types=1);

use App\Modules\Maintenance\Enums\ActorKind;
use App\Modules\Maintenance\Enums\AllocationTarget;
use App\Modules\Maintenance\Enums\ApprovalBasis;
use App\Modules\Maintenance\Enums\ApprovalStatus;
use App\Modules\Maintenance\Enums\DecidedVia;
use App\Modules\Maintenance\Enums\EventKind;
use App\Modules\Maintenance\Enums\FileKind;
use App\Modules\Maintenance\Enums\InterventionOrigin;
use App\Modules\Maintenance\Enums\InterventionStatus;
use App\Modules\Maintenance\Enums\Priority;
use App\Modules\Maintenance\Enums\QuoteKind;
use App\Modules\Maintenance\Enums\QuoteStatus;
use App\Modules\Maintenance\Enums\ReportedUrgency;
use App\Modules\Maintenance\Enums\Responsibility;
use App\Modules\Maintenance\Enums\SupplierInvoiceStatus;
use App\Modules\Maintenance\Enums\SupplierPaymentMethod;
use App\Modules\Maintenance\Enums\SupplierStatus;
use App\Modules\Maintenance\Enums\TaxCategory;
use App\Modules\Maintenance\Enums\VisitSlot;
use App\Modules\Maintenance\Enums\VisitStatus;
use App\Shared\Database\Checks;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const array FIGEES_INTERVENTION = ['reference', 'organization_id', 'origin', 'reporter_party_id', 'reported_on', 'lease_id'];

    private const array FIGEES_DEVIS = [
        'organization_id', 'intervention_id', 'supplier_party_id', 'reference', 'kind', 'issued_on', 'valid_until', 'stored_file_id',
        'total_net', 'total_tax', 'total_gross', 'currency',
    ];

    private const array FIGEES_FACTURE = [
        'id', 'organization_id', 'intervention_id', 'supplier_party_id', 'billed_party_id', 'number', 'invoice_on', 'due_on', 'currency',
        'total_net', 'total_tax', 'total_gross', 'stored_file_id', 'fingerprint', 'snapshot', 'ledger_entry_id', 'exceeds_approved_amount',
        'idempotency_key', 'created_by_user_id', 'created_at',
    ];

    private const array FIGEES_IMPUTATION = [
        'id', 'organization_id', 'supplier_invoice_id', 'intervention_id', 'target', 'party_id', 'lease_id', 'share_amount', 'wear_basis_points',
        'charged_amount', 'currency', 'basis_note', 'ledger_entry_id', 'idempotency_key', 'fingerprint', 'created_by_user_id', 'created_at',
    ];

    private const array FIGEES_REGLEMENT = [
        'id', 'organization_id', 'supplier_invoice_id', 'amount', 'currency', 'paid_on', 'method', 'reference', 'idempotency_key',
        'fingerprint', 'ledger_entry_id', 'recorded_by_user_id', 'created_at',
    ];

    public function up(): void
    {
        Schema::create('intervention_sequences', function (Blueprint $table): void {
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->unsignedSmallInteger('year');
            $table->unsignedInteger('last_value')->default(0);

            $table->primary(['organization_id', 'year']);
        });

        Schema::create('interventions', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->string('reference', 16);
            $table->string('origin', 8);
            $table->string('status', 20);
            $table->string('priority', 8)->default(Priority::Normal->value);
            $table->string('reported_urgency', 8)->nullable();
            $table->foreignUuid('nature_term_id')->constrained('terms');
            $table->string('title', 160);
            $table->string('description', 1000);
            $table->string('room', 120)->nullable();
            $table->string('availability', 200)->nullable();
            $table->uuid('property_id')->nullable();
            $table->uuid('unit_id')->nullable();
            $table->uuid('lease_id')->nullable();
            $table->uuid('mandate_id')->nullable();
            $table->uuid('mandant_party_id')->nullable();
            $table->uuid('reporter_party_id')->nullable();
            $table->uuid('supplier_party_id')->nullable();
            $table->string('responsibility', 16)->default(Responsibility::Undetermined->value);
            $table->date('reported_on');
            $table->date('due_on')->nullable();
            $table->unsignedBigInteger('estimated_amount')->nullable();
            $table->unsignedBigInteger('ceiling_amount')->nullable();
            $table->char('currency', 3);
            $table->string('approval_basis', 16)->nullable();
            $table->string('emergency_reason', 500)->nullable();
            $table->string('decline_reason', 32)->nullable();
            $table->string('decline_note', 500)->nullable();
            $table->date('completed_on')->nullable();
            $table->string('completion_note', 1000)->nullable();
            $table->dateTime('closed_at', 6)->nullable();
            $table->uuid('follows_intervention_id')->nullable();
            $table->json('custom_fields')->nullable();
            $table->string('idempotency_key', 120)->nullable();
            $table->char('request_hash', 64)->nullable();
            $table->uuid('created_by_user_id')->nullable();
            $table->unsignedInteger('lock_version')->default(1);
            $table->datetimes(6);

            $table->unique(['organization_id', 'id']);
            $table->unique(['organization_id', 'reference']);
            $table->unique(['organization_id', 'idempotency_key']);
            $table->index(['organization_id', 'status', 'created_at']);
            $table->index(['organization_id', 'lease_id', 'status']);
            $table->index(['organization_id', 'unit_id']);
            $table->index(['organization_id', 'supplier_party_id']);
            $table->foreign(['organization_id', 'follows_intervention_id'])->references(['organization_id', 'id'])->on('interventions');
        });

        Schema::create('intervention_events', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('intervention_id');
            $table->string('kind', 32);
            $table->string('actor_kind', 8);
            $table->uuid('actor_user_id')->nullable();
            $table->string('text', 500)->nullable();
            $table->json('metadata')->nullable();
            $table->boolean('visible_to_owner')->default(false);
            $table->boolean('visible_to_tenant')->default(false);
            $table->dateTime('created_at', 6);

            $table->unique(['organization_id', 'id']);
            $table->index(['intervention_id', 'created_at']);
            $table->foreign(['organization_id', 'intervention_id'])->references(['organization_id', 'id'])->on('interventions');
        });

        Schema::create('intervention_files', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('intervention_id');
            $table->uuid('stored_file_id');
            $table->string('kind', 16);
            $table->string('uploaded_by_kind', 8);
            $table->uuid('uploaded_by_user_id')->nullable();
            $table->boolean('visible_to_owner')->default(false);
            $table->boolean('visible_to_tenant')->default(false);
            $table->datetimes(6);

            $table->unique(['organization_id', 'id']);
            $table->unique(['organization_id', 'stored_file_id']);
            $table->index(['intervention_id', 'created_at']);
            $table->foreign(['organization_id', 'intervention_id'])->references(['organization_id', 'id'])->on('interventions');
        });

        Schema::create('intervention_visits', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('intervention_id');
            $table->uuid('supplier_party_id')->nullable();
            $table->date('scheduled_on');
            $table->string('slot', 10);
            $table->boolean('presence_required')->default(false);
            $table->string('status', 24);
            $table->date('requested_on')->nullable();
            $table->string('requested_slot', 10)->nullable();
            $table->string('contact_name', 120)->nullable();
            $table->string('contact_phone', 32)->nullable();
            $table->unsignedInteger('lock_version')->default(1);
            $table->datetimes(6);

            $table->unique(['organization_id', 'id']);
            $table->index(['intervention_id', 'status']);
            $table->foreign(['organization_id', 'intervention_id'])->references(['organization_id', 'id'])->on('interventions');
        });

        Schema::create('supplier_profiles', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('party_id');
            $table->string('status', 12);
            $table->boolean('preferred')->default(false);
            $table->unsignedSmallInteger('payment_terms_days')->nullable();
            $table->string('internal_note', 500)->nullable();
            $table->json('custom_fields')->nullable();
            $table->unsignedInteger('lock_version')->default(1);
            $table->datetimes(6);

            $table->unique(['organization_id', 'id']);
            $table->unique(['organization_id', 'party_id']);
        });

        Schema::create('supplier_trades', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('supplier_profile_id');
            $table->foreignUuid('nature_term_id')->constrained('terms');
            $table->datetimes(6);

            $table->unique(['supplier_profile_id', 'nature_term_id']);
            $table->foreign(['organization_id', 'supplier_profile_id'])->references(['organization_id', 'id'])->on('supplier_profiles');
        });

        Schema::create('intervention_quotes', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('intervention_id');
            $table->uuid('supplier_party_id');
            $table->string('reference', 60);
            $table->string('kind', 12);
            $table->string('status', 12);
            $table->date('issued_on');
            $table->date('valid_until')->nullable();
            $table->date('proposed_on')->nullable();
            $table->string('message', 500)->nullable();
            $table->uuid('stored_file_id');
            $table->unsignedBigInteger('total_net');
            $table->unsignedBigInteger('total_tax');
            $table->unsignedBigInteger('total_gross');
            $table->char('currency', 3);
            $table->uuid('created_by_user_id')->nullable();
            $table->unsignedInteger('lock_version')->default(1);
            $table->datetimes(6);

            $table->unique(['organization_id', 'id']);
            $table->index(['intervention_id', 'status']);
            $table->foreign(['organization_id', 'intervention_id'])->references(['organization_id', 'id'])->on('interventions');
        });

        Schema::create('intervention_quote_lines', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('quote_id');
            $table->unsignedSmallInteger('position');
            $table->string('label', 200);
            $table->unsignedBigInteger('quantity_milli');
            $table->string('unit', 16)->nullable();
            $table->unsignedBigInteger('unit_price');
            $table->unsignedBigInteger('net_amount');
            $table->string('tax_category', 2);
            $table->unsignedInteger('tax_rate_pcm');
            $table->datetimes(6);

            $table->unique(['quote_id', 'position']);
            $table->foreign(['organization_id', 'quote_id'])->references(['organization_id', 'id'])->on('intervention_quotes');
        });

        Schema::create('intervention_approvals', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('intervention_id');
            $table->uuid('quote_id')->nullable();
            $table->unsignedBigInteger('amount');
            $table->unsignedBigInteger('ceiling_amount');
            $table->char('currency', 3);
            $table->string('status', 12);
            $table->dateTime('requested_at', 6);
            $table->dateTime('decide_before', 6);
            $table->dateTime('decided_at', 6)->nullable();
            $table->string('decided_via', 16)->nullable();
            $table->uuid('decider_party_id')->nullable();
            $table->uuid('decided_by_user_id')->nullable();
            $table->string('comment', 500)->nullable();
            $table->uuid('proof_file_id')->nullable();
            $table->uuid('open_of_intervention')->nullable()->virtualAs("CASE WHEN status IN ('pending', 'question') THEN intervention_id END")->unique();
            $table->unsignedInteger('lock_version')->default(1);
            $table->datetimes(6);

            $table->unique(['organization_id', 'id']);
            $table->index(['intervention_id', 'status']);
            $table->index(['status', 'decide_before']);
            $table->foreign(['organization_id', 'intervention_id'])->references(['organization_id', 'id'])->on('interventions');
            $table->foreign(['organization_id', 'quote_id'])->references(['organization_id', 'id'])->on('intervention_quotes');
        });

        Schema::create('supplier_invoices', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('intervention_id');
            $table->uuid('supplier_party_id');
            $table->uuid('billed_party_id')->nullable();
            $table->string('number', 60);
            $table->date('invoice_on');
            $table->date('due_on')->nullable();
            $table->char('currency', 3);
            $table->unsignedBigInteger('total_net');
            $table->unsignedBigInteger('total_tax');
            $table->unsignedBigInteger('total_gross');
            $table->string('status', 12);
            $table->uuid('stored_file_id');
            $table->char('fingerprint', 64);
            $table->json('snapshot');
            $table->uuid('ledger_entry_id');
            $table->boolean('exceeds_approved_amount')->default(false);
            $table->string('idempotency_key', 120);
            $table->uuid('created_by_user_id')->nullable();
            $table->unsignedInteger('lock_version')->default(1);
            $table->datetimes(6);

            $table->unique(['organization_id', 'id']);
            $table->unique(['organization_id', 'supplier_party_id', 'number'], 'supplier_invoices_org_supplier_number_unique');
            $table->unique(['organization_id', 'fingerprint']);
            $table->unique(['organization_id', 'idempotency_key']);
            $table->index(['intervention_id', 'status']);
            $table->foreign(['organization_id', 'intervention_id'])->references(['organization_id', 'id'])->on('interventions');
        });

        Schema::create('supplier_invoice_taxes', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('supplier_invoice_id');
            $table->unsignedSmallInteger('position');
            $table->string('category', 2);
            $table->unsignedInteger('rate_pcm');
            $table->unsignedBigInteger('base_amount');
            $table->unsignedBigInteger('tax_amount');
            $table->datetimes(6);

            $table->unique(['supplier_invoice_id', 'category', 'rate_pcm'], 'supplier_invoice_taxes_invoice_category_rate_unique');
            $table->foreign(['organization_id', 'supplier_invoice_id'], 'supplier_invoice_taxes_org_invoice_foreign')->references(['organization_id', 'id'])->on('supplier_invoices');
        });

        Schema::create('invoice_allocations', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('supplier_invoice_id');
            $table->uuid('intervention_id');
            $table->string('target', 8);
            $table->uuid('party_id')->nullable();
            $table->uuid('lease_id')->nullable();
            $table->unsignedBigInteger('share_amount');
            $table->unsignedSmallInteger('wear_basis_points')->default(0);
            $table->unsignedBigInteger('charged_amount');
            $table->char('currency', 3);
            $table->string('basis_note', 255)->nullable();
            $table->uuid('ledger_entry_id');
            $table->string('idempotency_key', 120);
            $table->char('fingerprint', 64);
            $table->dateTime('cancelled_at', 6)->nullable();
            $table->uuid('cancellation_entry_id')->nullable();
            $table->uuid('created_by_user_id')->nullable();
            $table->datetimes(6);

            $table->unique(['organization_id', 'id']);
            $table->unique(['organization_id', 'idempotency_key']);
            $table->index(['supplier_invoice_id', 'cancelled_at']);
            $table->foreign(['organization_id', 'supplier_invoice_id'])->references(['organization_id', 'id'])->on('supplier_invoices');
        });

        Schema::create('supplier_payments', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('supplier_invoice_id');
            $table->unsignedBigInteger('amount');
            $table->char('currency', 3);
            $table->date('paid_on');
            $table->string('method', 16);
            $table->string('reference', 120)->nullable();
            $table->string('idempotency_key', 120);
            $table->char('fingerprint', 64);
            $table->uuid('ledger_entry_id');
            $table->dateTime('cancelled_at', 6)->nullable();
            $table->uuid('cancellation_entry_id')->nullable();
            $table->uuid('recorded_by_user_id')->nullable();
            $table->datetimes(6);

            $table->unique(['organization_id', 'id']);
            $table->unique(['organization_id', 'idempotency_key']);
            $table->index(['supplier_invoice_id', 'cancelled_at']);
            $table->foreign(['organization_id', 'supplier_invoice_id'])->references(['organization_id', 'id'])->on('supplier_invoices');
        });

        $this->controles();

        foreach ($this->verrous() as $instruction) {
            DB::connection()->getPdo()->exec($instruction);
        }
    }

    public function down(): void
    {
        foreach (['supplier_payments', 'invoice_allocations', 'supplier_invoice_taxes', 'supplier_invoices', 'intervention_approvals', 'intervention_quote_lines',
            'intervention_quotes', 'supplier_trades', 'supplier_profiles', 'intervention_visits', 'intervention_files', 'intervention_events',
            'interventions', 'intervention_sequences'] as $table) {
            Schema::dropIfExists($table);
        }
    }

    private function controles(): void
    {
        Checks::add('interventions', 'origin', Checks::enum('origin', InterventionOrigin::class));
        Checks::add('interventions', 'status', Checks::enum('status', InterventionStatus::class));
        Checks::add('interventions', 'priority', Checks::enum('priority', Priority::class));
        Checks::add('interventions', 'reported_urgency', Checks::enum('reported_urgency', ReportedUrgency::class, nullable: true));
        Checks::add('interventions', 'responsibility', Checks::enum('responsibility', Responsibility::class));
        Checks::add('interventions', 'approval_basis', Checks::enum('approval_basis', ApprovalBasis::class, nullable: true));
        Checks::add('interventions', 'currency', Checks::uppercase('currency', 3));
        Checks::add('intervention_events', 'kind', Checks::enum('kind', EventKind::class));
        Checks::add('intervention_events', 'actor_kind', Checks::enum('actor_kind', ActorKind::class));
        Checks::add('intervention_files', 'kind', Checks::enum('kind', FileKind::class));
        Checks::add('intervention_files', 'uploaded_by_kind', Checks::enum('uploaded_by_kind', ActorKind::class));
        Checks::add('intervention_files', 'tenant_visibility', "kind NOT IN ('quote', 'invoice', 'proof') OR visible_to_tenant = 0");
        Checks::add('intervention_visits', 'slot', Checks::enum('slot', VisitSlot::class));
        Checks::add('intervention_visits', 'requested_slot', Checks::enum('requested_slot', VisitSlot::class, nullable: true));
        Checks::add('intervention_visits', 'status', Checks::enum('status', VisitStatus::class));
        Checks::add('supplier_profiles', 'status', Checks::enum('status', SupplierStatus::class));
        Checks::add('intervention_quotes', 'kind', Checks::enum('kind', QuoteKind::class));
        Checks::add('intervention_quotes', 'status', Checks::enum('status', QuoteStatus::class));
        Checks::add('intervention_quotes', 'currency', Checks::uppercase('currency', 3));
        Checks::add('intervention_quotes', 'totals', 'total_gross = total_net + total_tax');
        Checks::add('intervention_quote_lines', 'tax_category', Checks::enum('tax_category', TaxCategory::class));
        Checks::add('intervention_quote_lines', 'quantity', 'quantity_milli > 0');
        Checks::add('intervention_approvals', 'status', Checks::enum('status', ApprovalStatus::class));
        Checks::add('intervention_approvals', 'decided_via', Checks::enum('decided_via', DecidedVia::class, nullable: true));
        Checks::add('intervention_approvals', 'proof', "decided_via IS NULL OR decided_via <> 'agency_recorded' OR proof_file_id IS NOT NULL");
        Checks::add('supplier_invoices', 'status', Checks::enum('status', SupplierInvoiceStatus::class));
        Checks::add('supplier_invoices', 'currency', Checks::uppercase('currency', 3));
        Checks::add('supplier_invoices', 'totals', 'total_gross = total_net + total_tax');
        Checks::add('supplier_invoice_taxes', 'category', Checks::enum('category', TaxCategory::class));
        Checks::add('invoice_allocations', 'target', Checks::enum('target', AllocationTarget::class));
        Checks::add('invoice_allocations', 'amounts', 'share_amount > 0 AND charged_amount <= share_amount');
        Checks::add('invoice_allocations', 'wear', 'wear_basis_points <= 10000');
        Checks::add('invoice_allocations', 'cancellation', '(cancelled_at IS NULL) = (cancellation_entry_id IS NULL)');
        Checks::add('supplier_payments', 'method', Checks::enum('method', SupplierPaymentMethod::class));
        Checks::add('supplier_payments', 'amount', 'amount > 0');
        Checks::add('supplier_payments', 'cancellation', '(cancelled_at IS NULL) = (cancellation_entry_id IS NULL)');
    }

    /**
     * @param  list<string>  $colonnes
     */
    private function different(array $colonnes, bool $sqlite): string
    {
        return implode(' OR ', array_map(fn (string $c): string => $sqlite ? "NEW.{$c} IS NOT OLD.{$c}" : "NOT (NEW.{$c} <=> OLD.{$c})", $colonnes));
    }

    /**
     * Pièces figées (ADR 0029) : chronologie en ajout seul (seul le texte d'un commentaire du locataire peut être remplacé par « [effacé] » à son anonymisation), devis figé dès sa soumission, accord tranché, facture reçue et
     * imputations immuables, rien ne se supprime.
     *
     * @return list<string>
     */
    private function verrous(): array
    {
        $sqlite = DB::getDriverName() === 'sqlite';

        if (! $sqlite && ! in_array(DB::getDriverName(), ['mysql', 'mariadb'], true)) {
            throw new RuntimeException('Pilote de base sans verrou : '.DB::getDriverName());
        }

        $devisFige = "(SELECT status FROM intervention_quotes WHERE id = %s.quote_id) <> 'received'";
        $imputee = $this->different(self::FIGEES_IMPUTATION, $sqlite);
        $reglee = $this->different(self::FIGEES_REGLEMENT, $sqlite);
        $evenementInchange = $this->different(['id', 'organization_id', 'intervention_id', 'kind', 'actor_kind', 'actor_user_id', 'metadata', 'visible_to_owner', 'visible_to_tenant', 'created_at'], $sqlite);
        $effacement = $sqlite
            ? "NOT (OLD.actor_kind = 'tenant' AND OLD.kind = 'comment' AND NEW.text IS '[effacé]' AND NOT ({$evenementInchange}))"
            : "NOT (OLD.actor_kind = 'tenant' AND OLD.kind = 'comment' AND NEW.text <=> '[effacé]' AND NOT ({$evenementInchange}))";

        $regles = [
            ['interventions_figee', 'BEFORE UPDATE', 'interventions', $this->different(self::FIGEES_INTERVENTION, $sqlite), 'interventions : identité figée'],
            ['interventions_sans_retour', 'BEFORE UPDATE', 'interventions', "OLD.status IN ('declined', 'cancelled', 'closed') AND NEW.status <> OLD.status", 'interventions : état terminal'],
            ['interventions_sans_suppression', 'BEFORE DELETE', 'interventions', '1 = 1', 'interventions ne se supprime pas'],
            ['intervention_events_sans_modification', 'BEFORE UPDATE', 'intervention_events', $effacement, 'intervention_events est en ajout seul'],
            ['intervention_events_sans_suppression', 'BEFORE DELETE', 'intervention_events', '1 = 1', 'intervention_events est en ajout seul'],
            ['intervention_quote_lines_insertion', 'BEFORE INSERT', 'intervention_quote_lines', sprintf($devisFige, 'NEW'), 'lignes de devis figées'],
            ['intervention_quote_lines_modification', 'BEFORE UPDATE', 'intervention_quote_lines', sprintf($devisFige, 'OLD'), 'lignes de devis figées'],
            ['intervention_quote_lines_suppression', 'BEFORE DELETE', 'intervention_quote_lines', sprintf($devisFige, 'OLD'), 'lignes de devis figées'],
            ['intervention_quotes_figee', 'BEFORE UPDATE', 'intervention_quotes', "OLD.status <> 'received' AND (".$this->different(self::FIGEES_DEVIS, $sqlite).')', 'devis figé après réception'],
            ['intervention_quotes_sans_suppression', 'BEFORE DELETE', 'intervention_quotes', '1 = 1', 'intervention_quotes ne se supprime pas'],
            ['intervention_approvals_figee', 'BEFORE UPDATE', 'intervention_approvals', "OLD.status IN ('accepted', 'refused', 'expired', 'withdrawn')", 'une demande tranchée ne change plus'],
            ['intervention_approvals_sans_suppression', 'BEFORE DELETE', 'intervention_approvals', '1 = 1', 'intervention_approvals ne se supprime pas'],
            ['supplier_invoices_figee', 'BEFORE UPDATE', 'supplier_invoices', $this->different(self::FIGEES_FACTURE, $sqlite), 'une facture reçue est immuable'],
            ['supplier_invoices_sans_suppression', 'BEFORE DELETE', 'supplier_invoices', '1 = 1', 'supplier_invoices ne se supprime pas'],
            ['supplier_invoice_taxes_figee', 'BEFORE UPDATE', 'supplier_invoice_taxes', '1 = 1', 'supplier_invoice_taxes est figé'],
            ['supplier_invoice_taxes_sans_suppression', 'BEFORE DELETE', 'supplier_invoice_taxes', '1 = 1', 'supplier_invoice_taxes est figé'],
            ['invoice_allocations_figee', 'BEFORE UPDATE', 'invoice_allocations', "({$imputee}) OR OLD.cancelled_at IS NOT NULL OR OLD.cancellation_entry_id IS NOT NULL", 'invoice_allocations : seule l\'\'annulation est permise'],
            ['invoice_allocations_sans_suppression', 'BEFORE DELETE', 'invoice_allocations', '1 = 1', 'invoice_allocations ne se supprime pas'],
            ['supplier_payments_figee', 'BEFORE UPDATE', 'supplier_payments', "({$reglee}) OR OLD.cancelled_at IS NOT NULL OR OLD.cancellation_entry_id IS NOT NULL", 'supplier_payments : seule l\'\'annulation est permise'],
            ['supplier_payments_sans_suppression', 'BEFORE DELETE', 'supplier_payments', '1 = 1', 'supplier_payments ne se supprime pas'],
        ];

        return array_map(fn (array $r): string => $sqlite
            ? "CREATE TRIGGER {$r[0]} {$r[1]} ON {$r[2]} FOR EACH ROW WHEN ({$r[3]}) BEGIN SELECT RAISE(ABORT, '{$r[4]}'); END"
            : "CREATE TRIGGER {$r[0]} {$r[1]} ON {$r[2]} FOR EACH ROW IF ({$r[3]}) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '{$r[4]}'; END IF", $regles);
    }
};
