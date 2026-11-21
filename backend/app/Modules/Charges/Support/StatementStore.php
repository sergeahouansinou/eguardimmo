<?php

declare(strict_types=1);

namespace App\Modules\Charges\Support;

use App\Modules\Charges\Data\BuiltStatement;
use App\Modules\Charges\Enums\StatementStatus;
use App\Modules\Charges\Models\ChargeStatement;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Écritures de masse des décomptes en aperçu : sans événement Eloquent, d'où l'audit explicite de l'appelant (AGENTS.md).
 */
final readonly class StatementStore
{
    public function __construct(private CurrentOrganization $organisation) {}

    public function purgeComputed(string $exerciseId): int
    {
        $ids = ChargeStatement::query()->where('exercise_id', $exerciseId)->where('status', StatementStatus::Computed->value)->pluck('id')->all();

        if ($ids === []) {
            return 0;
        }

        foreach (array_chunk($ids, 500) as $lot) {
            DB::table('charge_statement_lines')->whereIn('statement_id', $lot)->delete();
            DB::table('charge_statements')->whereIn('id', $lot)->delete();
        }

        return count($ids);
    }

    /**
     * @param  list<BuiltStatement>  $decomptes
     */
    public function insert(array $decomptes): void
    {
        $maintenant = Carbon::now()->format('Y-m-d H:i:s.u');
        $organisation = $this->organisation->id();

        foreach (array_chunk($decomptes, 100) as $lot) {
            $lignesDuLot = [];
            $rangees = [];

            foreach ($lot as $decompte) {
                $id = (string) Str::uuid7();
                $rangees[] = [...$decompte->row, 'id' => $id, 'organization_id' => $organisation, 'created_at' => $maintenant, 'updated_at' => $maintenant];

                foreach ($decompte->lines as $ligne) {
                    $lignesDuLot[] = [...$ligne, 'id' => (string) Str::uuid7(), 'organization_id' => $organisation, 'statement_id' => $id, 'created_at' => $maintenant, 'updated_at' => $maintenant];
                }
            }

            DB::table('charge_statements')->insert($rangees);

            foreach (array_chunk($lignesDuLot, 300) as $morceau) {
                DB::table('charge_statement_lines')->insert($morceau);
            }
        }
    }
}
