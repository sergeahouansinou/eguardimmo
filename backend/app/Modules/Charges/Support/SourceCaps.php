<?php

declare(strict_types=1);

namespace App\Modules\Charges\Support;

use App\Modules\Charges\Enums\ErrorCode;
use App\Modules\Charges\Enums\ExerciseStatus;
use App\Modules\Charges\Enums\ExpenseStatus;
use App\Modules\Charges\Enums\SourceKind;
use App\Modules\Charges\Models\ChargeExercise;
use App\Modules\Charges\Models\ChargeItemSource;
use App\Modules\Charges\Models\ChargeStatement;
use App\Modules\Charges\Models\Expense;
use App\Modules\Maintenance\PublicApi\SupplierInvoiceDirectory;
use Carbon\CarbonImmutable;
use Illuminate\Support\Str;
use Money\Money;

/**
 * Part récupérable d'une source et ce qu'en retiennent déjà les exercices non écartés (ADR 0034 § 5). À lire sous le verrou de la source.
 */
final readonly class SourceCaps
{
    public function __construct(private SupplierInvoiceDirectory $factures) {}

    /**
     * @return array{cap: Money, proposal: Money}
     */
    public function resolve(SourceKind $genre, string $sourceId, ChargeExercise $exercice): array
    {
        return match ($genre) {
            SourceKind::Expense => $this->expense($sourceId, $exercice),
            SourceKind::SupplierInvoice => $this->invoice($sourceId, $exercice),
        };
    }

    /**
     * Cumul retenu par les autres exercices d'origine. Un rectificatif ne compte jamais pour les autres ; lui-même est plafonné par ce que les
     * exercices d'origine retiennent hors celui de son décompte rectifié, dont il reprend les postes.
     */
    public function usedElsewhere(SourceKind $genre, string $sourceId, ChargeExercise $exercice): int
    {
        $ecarte = $exercice->only_lease_id === null ? $exercice->id : $this->origin($exercice)->id;
        $retenues = ChargeItemSource::query()->where('source_kind', $genre->value)->where('source_id', $sourceId)->where('exercise_id', '<>', $ecarte)->get();

        if ($retenues->isEmpty()) {
            return 0;
        }

        $actifs = ChargeExercise::query()
            ->whereIn('id', $retenues->pluck('exercise_id')->unique()->values()->all())
            ->where('status', '<>', ExerciseStatus::Discarded->value)
            ->whereNull('only_lease_id')
            ->pluck('id')->all();

        return (int) $retenues->filter(fn (ChargeItemSource $r): bool => in_array($r->exercise_id, $actifs, true))->sum('amount');
    }

    private function origin(ChargeExercise $rectificatif): ChargeExercise
    {
        $courant = $rectificatif;

        for ($profondeur = 0; $courant->only_lease_id !== null && $profondeur < 50; $profondeur++) {
            $decompte = ChargeStatement::query()->find($courant->supersedes_statement_id) ?? throw ErrorCode::StatementNotFound->problem();
            $courant = ChargeExercise::query()->findOrFail($decompte->exercise_id);
        }

        return $courant;
    }

    /**
     * @return array{cap: Money, proposal: Money}
     */
    private function expense(string $id, ChargeExercise $exercice): array
    {
        $depense = Str::isUuid($id) ? Expense::query()->find($id) : null;

        if ($depense === null || $depense->property_id !== $exercice->property_id || $depense->status !== ExpenseStatus::Recorded || ! $depense->recoverable_amount->isPositive()) {
            throw ErrorCode::ItemInvalid->problem('Cette dépense n\'est pas une source récupérable de ce bien.');
        }

        $debut = max($depense->service_from->toDateString(), $exercice->period_start->toDateString());
        $fin = min($depense->service_to->toDateString(), $exercice->period_end->toDateString());
        $jours = max(0, (int) CarbonImmutable::parse($debut)->diffInDays(CarbonImmutable::parse($fin), false));
        $duree = max(1, (int) $depense->service_from->diffInDays($depense->service_to));
        $proposition = $depense->recoverable_amount->multiply((string) $jours)->divide((string) $duree, Money::ROUND_DOWN);

        return ['cap' => $depense->recoverable_amount, 'proposal' => $proposition];
    }

    /**
     * @return array{cap: Money, proposal: Money}
     */
    private function invoice(string $id, ChargeExercise $exercice): array
    {
        $parts = $this->factures->ownerShares([$id]);

        if ($parts === [] || $parts[0]->propertyId !== $exercice->property_id) {
            throw ErrorCode::ItemInvalid->problem('Cette facture n\'est pas imputée au propriétaire sur ce bien.');
        }

        return ['cap' => $parts[0]->ownerShare, 'proposal' => $parts[0]->ownerShare];
    }
}
