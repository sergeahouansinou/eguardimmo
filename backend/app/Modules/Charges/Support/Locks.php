<?php

declare(strict_types=1);

namespace App\Modules\Charges\Support;

use App\Modules\Charges\Enums\ErrorCode;
use App\Modules\Charges\Enums\SourceKind;
use App\Modules\Charges\Models\ChargeExercise;
use App\Modules\Charges\Models\ChargeKey;
use App\Modules\Charges\Models\ChargeStatement;
use App\Modules\Charges\Models\Expense;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Ordre fixe (ADR 0034 § 11) : verrou de bien, puis exercice, puis décompte ou dépense ; les verrous de Rent, du compte mandant
 * et des périodes viennent ensuite, pris par leurs modules. Aucune lecture non verrouillante avant le verrou.
 */
final readonly class Locks
{
    public function __construct(private CurrentOrganization $organisation) {}

    public function property(string $propertyId): void
    {
        DB::table('charge_property_locks')->insertOrIgnore(['property_id' => $propertyId, 'organization_id' => $this->organisation->id()]);
        DB::table('charge_property_locks')->where('property_id', $propertyId)->where('organization_id', $this->organisation->id())->lockForUpdate()->first();
    }

    public function source(SourceKind $genre, string $sourceId): void
    {
        DB::table('charge_source_locks')->insertOrIgnore(['source_kind' => $genre->value, 'source_id' => $sourceId, 'organization_id' => $this->organisation->id()]);
        DB::table('charge_source_locks')->where('source_kind', $genre->value)->where('source_id', $sourceId)->where('organization_id', $this->organisation->id())->lockForUpdate()->first();
    }

    public function exercise(string $id): ChargeExercise
    {
        return (Str::isUuid($id) ? ChargeExercise::query()->whereKey($id)->lockForUpdate()->first() : null)
            ?? throw ErrorCode::ExerciseNotFound->problem();
    }

    /**
     * Le bien d'un exercice ne change jamais : sa lecture avant verrou est sûre et permet de respecter l'ordre bien, puis exercice.
     */
    public function exerciseOfProperty(string $id): ChargeExercise
    {
        $bien = Str::isUuid($id) ? ChargeExercise::query()->whereKey($id)->value('property_id') : null;

        if (! is_string($bien)) {
            throw ErrorCode::ExerciseNotFound->problem();
        }

        $this->property($bien);

        return $this->exercise($id);
    }

    public function statement(string $id): ChargeStatement
    {
        return (Str::isUuid($id) ? ChargeStatement::query()->whereKey($id)->lockForUpdate()->first() : null)
            ?? throw ErrorCode::StatementNotFound->problem();
    }

    public function expense(string $id): Expense
    {
        return (Str::isUuid($id) ? Expense::query()->whereKey($id)->lockForUpdate()->first() : null)
            ?? throw ErrorCode::ExpenseNotFound->problem();
    }

    public function key(string $id): ChargeKey
    {
        return (Str::isUuid($id) ? ChargeKey::query()->whereKey($id)->lockForUpdate()->first() : null)
            ?? throw ErrorCode::KeyNotFound->problem();
    }
}
