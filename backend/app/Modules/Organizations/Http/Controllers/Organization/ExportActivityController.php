<?php

declare(strict_types=1);

namespace App\Modules\Organizations\Http\Controllers\Organization;

use App\Modules\Organizations\Data\ActivityEntryData;
use App\Modules\Organizations\Enums\ErrorCode;
use App\Modules\Organizations\Http\Requests\ExportActivityRequest;
use App\Modules\Organizations\Queries\OrganizationActivity;
use App\Modules\Organizations\Support\ActivityCsv;
use App\Modules\Organizations\Support\OrganizationContext;
use App\Shared\Audit\RecordAudit;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class ExportActivityController
{
    public function __invoke(ExportActivityRequest $request, OrganizationActivity $journal, RecordAudit $audit): StreamedResponse
    {
        $organisation = OrganizationContext::organization($request);
        $filtres = $request->filters();
        $lignes = $journal->count($filtres);

        if ($lignes > (int) config('organizations.activity.export_max_rows')) {
            throw ErrorCode::ActivityExportTooLarge->problem();
        }

        $audit->handle('organizations.activity.exported', subject: $organisation, metadata: [
            'from' => $request->filled('from') ? (string) $request->validated('from') : null,
            'to' => $request->filled('to') ? (string) $request->validated('to') : null,
            'rows' => $lignes,
        ]);

        $fuseau = $organisation->timezone;

        return response()->stream(function () use ($journal, $filtres, $fuseau): void {
            echo "\u{FEFF}".ActivityCsv::line(['date', 'type', 'libelle', 'auteur', 'entite', 'entite_id', 'action', 'origine', 'appareil']);

            $journal->each($filtres, function (ActivityEntryData $e) use ($fuseau): void {
                echo ActivityCsv::line([
                    $e->occurredAt->setTimezone($fuseau)->toIso8601String(), $e->type->value, $e->label, $e->actorName ?? '', (string) $e->subjectType,
                    (string) $e->subjectId, $e->action, (string) $e->ip, (string) $e->device,
                ]);
            });
        }, 200, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => 'attachment; filename="journal-activite.csv"',
            'Cache-Control' => 'no-store, private',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }
}
