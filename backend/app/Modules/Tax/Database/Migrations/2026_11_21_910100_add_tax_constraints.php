<?php

declare(strict_types=1);

use App\Modules\Tax\Enums\SummaryScope;
use App\Modules\Tax\Enums\SummaryStatus;
use App\Shared\Database\Checks;
use App\Shared\Database\RowGuards;
use Illuminate\Database\Migrations\Migration;

return new class extends Migration
{
    public function up(): void
    {
        Checks::add('tax_summaries', 'scope', Checks::enum('scope', SummaryScope::class));
        Checks::add('tax_summaries', 'status', Checks::enum('status', SummaryStatus::class));
        Checks::add('tax_summaries', 'currency', Checks::uppercase('currency', 3));
        Checks::add('tax_summaries', 'mandant', "(scope = 'mandant' AND mandant_party_id IS NOT NULL) OR (scope = 'organization' AND mandant_party_id IS NULL)");

        $colonnes = ['id', 'organization_id', 'scope', 'mandant_party_id', 'income_year', 'form_version', 'currency', 'snapshot', 'ledger_cutoff', 'fingerprint', 'template_version', 'issued_document_id',
            'stored_file_id', 'supersedes_id', 'rectification_reason', 'idempotency_key', 'request_hash', 'created_by_user_id', 'created_at'];

        RowGuards::install([
            ['tax_summaries_figees', 'BEFORE UPDATE', 'tax_summaries', RowGuards::changed($colonnes), 'tax_summaries : synthese figee'],
            ['tax_summaries_statut_final', 'BEFORE UPDATE', 'tax_summaries', "(OLD.status = 'superseded' AND (".RowGuards::changed(['status', 'published_at', 'published_by_user_id']).")) OR (OLD.status = 'published' AND NEW.status = 'final')", 'tax_summaries : statut final'],
            ['tax_summaries_sans_suppression', 'BEFORE DELETE', 'tax_summaries', '1 = 1', 'tax_summaries ne se supprime pas'],
            ...RowGuards::frozenExcept('tax_summary_lines', ['id', 'organization_id', 'summary_id', 'property_id', 'line_code', 'status', 'amount_exact', 'amount_rounded', 'sources', 'position', 'created_at', 'updated_at'], []),
        ]);
    }

    public function down(): void
    {
        // Contraintes et déclencheurs tombent avec leurs tables (migration 910000).
    }
};
