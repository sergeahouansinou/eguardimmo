<?php

declare(strict_types=1);

namespace App\Modules\Charges\Support;

use App\Modules\Charges\Enums\SourceKind;
use App\Modules\Charges\Models\ChargeItem;
use App\Modules\Charges\Models\ChargeItemSource;
use App\Modules\Charges\Models\ChargeStatement;
use App\Modules\Charges\Models\ChargeStatementFile;
use App\Modules\Charges\Models\ChargeStatementLine;
use App\Modules\Charges\Models\Expense;
use App\Modules\Charges\Models\ExpenseFile;

/**
 * Pièces justificatives d'un décompte : celles des dépenses qui nourrissent un poste où il a une ligne, jamais celles d'un autre lot ; elles
 * ne sont visibles du locataire que si l'équipe les publie (ADR 0034 § 8). Le libellé reste neutre : rubrique et référence, jamais le tiers payé.
 */
final class StatementFiles
{
    public function attach(ChargeStatement $decompte): void
    {
        $postes = ChargeStatementLine::query()->where('statement_id', $decompte->id)->pluck('item_id')->unique()->values()->all();

        if ($postes === []) {
            return;
        }

        $rubriques = ChargeItem::query()->whereIn('id', $postes)->pluck('rubric', 'id');
        $sources = ChargeItemSource::query()->whereIn('item_id', $postes)->where('source_kind', SourceKind::Expense->value)->orderBy('id')->get(['item_id', 'source_id']);
        $rubriqueDe = [];

        foreach ($sources as $source) {
            $rubriqueDe[$source->source_id] ??= (string) $rubriques->get($source->item_id);
        }

        if ($rubriqueDe === []) {
            return;
        }

        $depenses = Expense::query()->whereIn('id', array_keys($rubriqueDe))->get()->keyBy('id');

        foreach (ExpenseFile::query()->whereIn('expense_id', array_keys($rubriqueDe))->orderBy('id')->get() as $piece) {
            $reference = $depenses->get($piece->expense_id)?->reference;
            $libelle = mb_substr(trim($rubriqueDe[$piece->expense_id].($reference === null ? '' : ' — '.$reference)), 0, 120);

            ChargeStatementFile::query()->firstOrCreate(
                ['statement_id' => $decompte->id, 'stored_file_id' => $piece->stored_file_id],
                ['label' => $libelle === '' ? 'Pièce justificative' : $libelle, 'tenant_visible' => false],
            );
        }
    }
}
