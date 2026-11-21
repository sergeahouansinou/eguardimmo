<?php

declare(strict_types=1);

namespace App\Modules\Charges\Http\Controllers\Organization;

use App\Modules\Charges\Enums\ErrorCode;
use App\Modules\Charges\Http\Requests\ExportExpensesRequest;
use App\Modules\Charges\Models\Expense;
use App\Modules\Charges\Support\Csv;
use App\Shared\Audit\RecordAudit;
use Illuminate\Http\Response;

final class ExportExpensesCsvController
{
    public function __invoke(ExportExpensesRequest $request, RecordAudit $audit): Response
    {
        $limite = (int) config('charges.export_max_rows');
        $requete = Expense::query()->where('document_on', '>=', $request->from())->where('document_on', '<', $request->to())
            ->when($request->propertyId() !== null, fn ($q) => $q->where('property_id', $request->propertyId()))->orderBy('document_on')->orderBy('id');

        if ($requete->count() > $limite) {
            throw ErrorCode::ExpenseInvalid->problem('Export trop volumineux : réduisez la période.');
        }

        $lignes = [['date', 'bien', 'lot', 'reference', 'fournisseur', 'statut', 'reglement', 'total_minor', 'recuperable_minor', 'devise']];

        foreach ($requete->get() as $d) {
            $lignes[] = [$d->document_on->toDateString(), $d->property_id, (string) $d->unit_id, (string) $d->reference, (string) $d->payee_label, $d->status->value, $d->settlement->value,
                (int) $d->total_gross->getAmount(), (int) $d->recoverable_amount->getAmount(), $d->currency];
        }

        $audit->handle('charges.export.generated', metadata: ['kind' => 'expenses', 'rows' => count($lignes) - 1]);

        return response(Csv::render($lignes), 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="depenses-'.$request->from().'.csv"',
            'Cache-Control' => 'no-store, private',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }
}
