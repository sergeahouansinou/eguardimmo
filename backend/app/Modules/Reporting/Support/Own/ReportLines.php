<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Support\Own;

use App\Modules\Reporting\Data\ReportLineInput;
use App\Modules\Reporting\Models\ManagementReport;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

final class ReportLines
{
    private const int LOT = 200;

    /**
     * Remplace les lignes d'un brouillon ou d'un compte rendu généré (le déclencheur refuse tout sur un publié).
     *
     * @param  list<ReportLineInput>  $lignes
     */
    public function replace(ManagementReport $rapport, array $lignes): void
    {
        DB::table('management_report_lines')->where('report_id', $rapport->id)->delete();
        $maintenant = Carbon::now()->format('Y-m-d H:i:s.u');
        $rangees = [];

        foreach ($lignes as $position => $ligne) {
            $rangees[] = [
                'id' => (string) Str::uuid7(),
                'organization_id' => $rapport->organization_id,
                'report_id' => $rapport->id,
                'position' => $position + 1,
                'kind' => $ligne->kind->value,
                'entry_date' => $ligne->date,
                'unit_id' => $ligne->unitId,
                'lease_id' => $ligne->leaseId,
                'mandate_id' => $ligne->mandateId,
                'label' => $ligne->label,
                'amount' => $ligne->amount,
                'direction' => $ligne->direction->value,
                'source_type' => $ligne->sourceType,
                'source_id' => $ligne->sourceId,
                'created_at' => $maintenant,
                'updated_at' => $maintenant,
            ];
        }

        foreach (array_chunk($rangees, self::LOT) as $lot) {
            DB::table('management_report_lines')->insert($lot);
        }
    }
}
