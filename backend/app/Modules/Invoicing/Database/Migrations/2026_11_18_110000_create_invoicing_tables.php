<?php

declare(strict_types=1);

use App\Modules\Invoicing\Enums\InvoiceKind;
use App\Modules\Invoicing\Enums\InvoiceStatus;
use App\Modules\Invoicing\Enums\PaymentMethod;
use App\Modules\Invoicing\Enums\TaxCategory;
use App\Modules\Invoicing\Enums\TaxCode;
use App\Shared\Database\Checks;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const array FIGEES_FACTURE = [
        'id', 'organization_id', 'kind', 'credited_invoice_id', 'number', 'issued_on', 'due_on', 'service_from', 'service_to',
        'recipient_party_id', 'lease_id', 'mandate_id', 'jurisdiction', 'vat_regime', 'vat_on_debits', 'currency', 'total_net',
        'total_tax', 'total_gross', 'ledger_entry_id', 'issued_document_id', 'stored_file_id', 'fingerprint', 'template_version',
        'snapshot', 'credit_reason', 'idempotency_key', 'request_hash', 'discarded_at', 'issued_by_user_id', 'created_by_user_id',
        'created_at',
    ];

    private const array FIGEES_REGLEMENT = [
        'id', 'organization_id', 'invoice_id', 'amount', 'currency', 'paid_on', 'method', 'reference', 'idempotency_key',
        'fingerprint', 'ledger_entry_id', 'recorded_by_user_id', 'created_at',
    ];

    public function up(): void
    {
        Schema::create('invoice_sequences', function (Blueprint $table): void {
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->string('kind', 16);
            $table->unsignedSmallInteger('year');
            $table->unsignedInteger('last_value')->default(0);

            $table->primary(['organization_id', 'kind', 'year']);
        });

        Schema::create('invoices', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->string('kind', 16);
            $table->string('status', 16);
            $table->string('number', 24)->nullable();
            $table->uuid('credited_invoice_id')->nullable();
            $table->date('issued_on')->nullable();
            $table->date('due_on')->nullable();
            $table->date('service_from')->nullable();
            $table->date('service_to')->nullable();
            $table->uuid('recipient_party_id');
            $table->uuid('lease_id')->nullable();
            $table->uuid('mandate_id')->nullable();
            $table->char('jurisdiction', 2);
            $table->string('vat_regime', 16);
            $table->boolean('vat_on_debits')->default(false);
            $table->char('currency', 3);
            $table->unsignedBigInteger('total_net')->default(0);
            $table->unsignedBigInteger('total_tax')->default(0);
            $table->unsignedBigInteger('total_gross')->default(0);
            $table->uuid('ledger_entry_id')->nullable();
            $table->uuid('issued_document_id')->nullable();
            $table->uuid('stored_file_id')->nullable();
            $table->char('fingerprint', 64)->nullable();
            $table->string('template_version', 32)->nullable();
            $table->json('snapshot')->nullable();
            $table->string('credit_reason', 500)->nullable();
            $table->string('idempotency_key', 120)->nullable();
            $table->char('request_hash', 64)->nullable();
            $table->unsignedInteger('lock_version')->default(1);
            $table->dateTime('overdue_flagged_at', 6)->nullable();
            $table->dateTime('sent_at', 6)->nullable();
            $table->dateTime('discarded_at', 6)->nullable();
            $table->uuid('issued_by_user_id')->nullable();
            $table->uuid('created_by_user_id')->nullable();
            $table->datetimes(6);

            $table->unique(['organization_id', 'id']);
            $table->unique(['organization_id', 'number']);
            $table->unique(['organization_id', 'idempotency_key']);
            $table->index(['organization_id', 'status', 'due_on']);
            $table->index(['organization_id', 'lease_id', 'status']);
            $table->index(['organization_id', 'recipient_party_id']);
            $table->index(['organization_id', 'kind', 'status', 'created_at']);
            $table->foreign(['organization_id', 'credited_invoice_id'])->references(['organization_id', 'id'])->on('invoices');
        });

        Schema::create('invoice_lines', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('invoice_id');
            $table->unsignedSmallInteger('position');
            $table->foreignUuid('item_term_id')->constrained('terms');
            $table->string('item_semantic', 32);
            $table->string('description', 500);
            $table->unsignedBigInteger('quantity_milli');
            $table->unsignedBigInteger('unit_price');
            $table->unsignedBigInteger('net_amount');
            $table->string('tax_category', 2);
            $table->string('tax_rate_key', 64)->nullable();
            $table->unsignedInteger('tax_rate_pcm');
            $table->uuid('credited_line_id')->nullable();
            $table->datetimes(6);

            $table->unique(['organization_id', 'id']);
            $table->unique(['invoice_id', 'position']);
            $table->index('credited_line_id');
            $table->foreign(['organization_id', 'invoice_id'])->references(['organization_id', 'id'])->on('invoices');
            $table->foreign(['organization_id', 'credited_line_id'])->references(['organization_id', 'id'])->on('invoice_lines');
        });

        Schema::create('invoice_taxes', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('invoice_id');
            $table->unsignedSmallInteger('position');
            $table->string('tax_code', 8);
            $table->string('category', 2);
            $table->unsignedInteger('rate_pcm');
            $table->unsignedBigInteger('base_amount');
            $table->unsignedBigInteger('tax_amount');
            $table->datetimes(6);

            $table->unique(['organization_id', 'id']);
            $table->unique(['invoice_id', 'tax_code', 'category', 'rate_pcm']);
            $table->foreign(['organization_id', 'invoice_id'])->references(['organization_id', 'id'])->on('invoices');
        });

        Schema::create('invoice_payments', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('organization_id')->constrained('organizations');
            $table->uuid('invoice_id');
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
            $table->index(['invoice_id', 'cancelled_at']);
            $table->foreign(['organization_id', 'invoice_id'])->references(['organization_id', 'id'])->on('invoices');
        });

        Checks::add('invoice_sequences', 'kind', Checks::enum('kind', InvoiceKind::class));
        Checks::add('invoices', 'kind', Checks::enum('kind', InvoiceKind::class));
        Checks::add('invoices', 'status', Checks::enum('status', InvoiceStatus::class));
        Checks::add('invoices', 'currency', Checks::uppercase('currency', 3));
        Checks::add('invoices', 'jurisdiction', Checks::uppercase('jurisdiction', 2));
        Checks::add('invoices', 'totals', 'total_gross = total_net + total_tax');
        Checks::add('invoices', 'credit_note', "(kind = 'credit_note') = (credited_invoice_id IS NOT NULL)");
        Checks::add('invoices', 'number', "status IN ('draft', 'discarded') OR number IS NOT NULL");
        Checks::add('invoices', 'dates', 'due_on IS NULL OR issued_on IS NULL OR due_on >= issued_on');
        Checks::add('invoice_lines', 'tax_category', Checks::enum('tax_category', TaxCategory::class));
        Checks::add('invoice_lines', 'quantity', 'quantity_milli > 0');
        Checks::add('invoice_taxes', 'tax_code', Checks::enum('tax_code', TaxCode::class));
        Checks::add('invoice_taxes', 'category', Checks::enum('category', TaxCategory::class));
        Checks::add('invoice_payments', 'method', Checks::enum('method', PaymentMethod::class));
        Checks::add('invoice_payments', 'currency', Checks::uppercase('currency', 3));
        Checks::add('invoice_payments', 'amount', 'amount > 0');
        Checks::add('invoice_payments', 'cancellation', '(cancelled_at IS NULL) = (cancellation_entry_id IS NULL)');

        foreach ($this->verrous() as $instruction) {
            DB::connection()->getPdo()->exec($instruction);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('invoice_payments');
        Schema::dropIfExists('invoice_taxes');
        Schema::dropIfExists('invoice_lines');
        Schema::dropIfExists('invoices');
        Schema::dropIfExists('invoice_sequences');
    }

    /**
     * Une pièce émise est immuable (ADR 0028) : seuls le statut de règlement, le signalement de retard, l'envoi et la
     * version restent modifiables ; rien ne se supprime ; lignes et taxes ne bougent que sous un brouillon.
     *
     * @return list<string>
     */
    private function verrous(): array
    {
        return match (DB::getDriverName()) {
            'sqlite' => $this->verrousSqlite(),
            'mysql', 'mariadb' => $this->verrousMysql(),
            default => throw new RuntimeException('Pilote de base sans verrou : '.DB::getDriverName()),
        };
    }

    /**
     * @param  list<string>  $colonnes
     */
    private function different(array $colonnes, string $pilote): string
    {
        return implode(' OR ', array_map(fn (string $c): string => $pilote === 'sqlite' ? "NEW.{$c} IS NOT OLD.{$c}" : "NOT (NEW.{$c} <=> OLD.{$c})", $colonnes));
    }

    /**
     * @return list<string>
     */
    private function verrousSqlite(): array
    {
        $facture = $this->different(self::FIGEES_FACTURE, 'sqlite');
        $reglement = $this->different(self::FIGEES_REGLEMENT, 'sqlite');
        $enfants = [];

        foreach (['invoice_lines', 'invoice_taxes'] as $table) {
            foreach (['INSERT' => 'NEW', 'UPDATE' => 'NEW', 'DELETE' => 'OLD'] as $evenement => $ligne) {
                $enfants[] = "CREATE TRIGGER {$table}_brouillon_seul_{$evenement} BEFORE {$evenement} ON {$table} FOR EACH ROW WHEN (SELECT status FROM invoices WHERE id = {$ligne}.invoice_id) <> 'draft' BEGIN SELECT RAISE(ABORT, '{$table} ne bouge que sous un brouillon'); END";
            }
        }

        return [
            "CREATE TRIGGER invoices_figee BEFORE UPDATE ON invoices FOR EACH ROW WHEN OLD.number IS NOT NULL AND ({$facture}) BEGIN SELECT RAISE(ABORT, 'une pièce émise est immuable'); END",
            "CREATE TRIGGER invoices_sans_retour_brouillon BEFORE UPDATE ON invoices FOR EACH ROW WHEN OLD.status <> 'draft' AND NEW.status = 'draft' BEGIN SELECT RAISE(ABORT, 'une facture ne revient jamais en brouillon'); END",
            "CREATE TRIGGER invoices_sans_reprise_abandon BEFORE UPDATE ON invoices FOR EACH ROW WHEN OLD.status = 'discarded' AND NEW.status <> 'discarded' BEGIN SELECT RAISE(ABORT, 'un brouillon abandonné ne se rouvre pas'); END",
            "CREATE TRIGGER invoices_sans_suppression BEFORE DELETE ON invoices FOR EACH ROW BEGIN SELECT RAISE(ABORT, 'invoices ne se supprime pas'); END",
            ...$enfants,
            "CREATE TRIGGER invoice_payments_sans_suppression BEFORE DELETE ON invoice_payments FOR EACH ROW BEGIN SELECT RAISE(ABORT, 'invoice_payments ne se supprime pas'); END",
            "CREATE TRIGGER invoice_payments_figee BEFORE UPDATE ON invoice_payments FOR EACH ROW WHEN ({$reglement}) OR OLD.cancelled_at IS NOT NULL OR OLD.cancellation_entry_id IS NOT NULL BEGIN SELECT RAISE(ABORT, 'invoice_payments est figé : seule l''annulation est permise'); END",
        ];
    }

    /**
     * @return list<string>
     */
    private function verrousMysql(): array
    {
        $facture = $this->different(self::FIGEES_FACTURE, 'mysql');
        $reglement = $this->different(self::FIGEES_REGLEMENT, 'mysql');
        $enfants = [];

        foreach (['invoice_lines', 'invoice_taxes'] as $table) {
            foreach (['INSERT' => 'NEW', 'UPDATE' => 'NEW', 'DELETE' => 'OLD'] as $evenement => $ligne) {
                $enfants[] = "CREATE TRIGGER {$table}_brouillon_seul_{$evenement} BEFORE {$evenement} ON {$table} FOR EACH ROW IF (SELECT status FROM invoices WHERE id = {$ligne}.invoice_id) <> 'draft' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = '{$table} ne bouge que sous un brouillon'; END IF";
            }
        }

        return [
            "CREATE TRIGGER invoices_figee BEFORE UPDATE ON invoices FOR EACH ROW IF OLD.number IS NOT NULL AND ({$facture}) THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'une pièce émise est immuable'; END IF",
            "CREATE TRIGGER invoices_sans_retour_brouillon BEFORE UPDATE ON invoices FOR EACH ROW IF OLD.status <> 'draft' AND NEW.status = 'draft' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'une facture ne revient jamais en brouillon'; END IF",
            "CREATE TRIGGER invoices_sans_reprise_abandon BEFORE UPDATE ON invoices FOR EACH ROW IF OLD.status = 'discarded' AND NEW.status <> 'discarded' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'un brouillon abandonné ne se rouvre pas'; END IF",
            "CREATE TRIGGER invoices_sans_suppression BEFORE DELETE ON invoices FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'invoices ne se supprime pas'",
            ...$enfants,
            "CREATE TRIGGER invoice_payments_sans_suppression BEFORE DELETE ON invoice_payments FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'invoice_payments ne se supprime pas'",
            "CREATE TRIGGER invoice_payments_figee BEFORE UPDATE ON invoice_payments FOR EACH ROW IF ({$reglement}) OR OLD.cancelled_at IS NOT NULL OR OLD.cancellation_entry_id IS NOT NULL THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'invoice_payments est figé : seule l''annulation est permise'; END IF",
        ];
    }
};
