<?php

declare(strict_types=1);

namespace App\Modules\Charges\Http\Controllers\Organization;

use App\Modules\Charges\Enums\ErrorCode;
use App\Modules\Charges\Queries\Exercises;
use App\Modules\Charges\Queries\Statements;
use App\Modules\Charges\Support\Csv;
use App\Shared\Audit\RecordAudit;
use Illuminate\Http\Response;

final class ExportStatementsCsvController
{
    public function __invoke(string $exercise, Exercises $exercices, Statements $decomptes, RecordAudit $audit): Response
    {
        $e = $exercices->get($exercise);
        $limite = (int) config('charges.export_max_rows');
        $liste = $decomptes->ofExercise($e->id, $limite);

        if ($liste->count() > $limite) {
            throw ErrorCode::ExpenseInvalid->problem('Export trop volumineux : réduisez le périmètre.');
        }

        $lignes = [['numero', 'bail', 'statut', 'jours', 'part_minor', 'provisions_minor', 'non_regle_minor', 'solde_minor', 'devise', 'reglement']];

        foreach ($liste as $d) {
            $lignes[] = [(string) $d->number, $d->lease_id, $d->status->value, $d->occupied_days, (int) $d->share_total->getAmount(), (int) $d->provisions_called->getAmount(),
                (int) $d->provisions_unpaid->getAmount(), (int) $d->balance->getAmount(), $d->currency, (string) $d->settlement?->value];
        }

        $audit->handle('charges.export.generated', subject: $e, metadata: ['kind' => 'statements', 'rows' => count($lignes) - 1]);

        return response(Csv::render($lignes), 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="decomptes-'.$e->period_start->format('Y-m-d').'.csv"',
            'Cache-Control' => 'no-store, private',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }
}
