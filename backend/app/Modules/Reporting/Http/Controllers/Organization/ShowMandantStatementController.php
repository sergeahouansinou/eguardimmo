<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Http\Controllers\Organization;

use App\Modules\Accounting\Enums\AccountRole;
use App\Modules\Accounting\PublicApi\LedgerAggregates;
use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Modules\Parties\PublicApi\PartyDirectory;
use App\Modules\Reporting\Enums\ErrorCode;
use App\Modules\Reporting\Http\Requests\StatementRequest;
use App\Modules\Reporting\Http\Resources\PartyStatementResource;
use App\Modules\Reporting\Support\StatementCsv;
use App\Shared\Audit\RecordAudit;
use App\Shared\Http\ApiProblem;
use Carbon\CarbonImmutable;
use Illuminate\Http\Response;

final class ShowMandantStatementController
{
    public function __invoke(string $mandant, StatementRequest $request, PartyDirectory $parties, LedgerAggregates $grandLivre, OrganizationDirectory $organisations, RecordAudit $audit): PartyStatementResource|Response
    {
        try {
            $partie = $parties->find($mandant);
        } catch (ApiProblem $erreur) {
            throw $erreur->status === 404 ? ErrorCode::MandantNotFound->problem() : $erreur;
        }

        $devise = $organisations->currency();
        $releve = $grandLivre->partyStatement($partie->id, AccountRole::OwnerPayable, $devise, CarbonImmutable::parse($request->string('from')->toString()), CarbonImmutable::parse($request->string('to')->toString()));
        $audit->handle('reporting.statement.viewed', metadata: ['mandant_party_id' => $partie->id, 'from' => $releve->from->toDateString(), 'to' => $releve->to->toDateString()]);

        if ($request->string('format')->toString() === 'csv') {
            return response(StatementCsv::render($releve, $devise->getCode()), 200, ['Content-Type' => 'text/csv; charset=UTF-8', 'Content-Disposition' => 'attachment; filename="releve-mandant.csv"', 'Cache-Control' => 'no-store, private', 'X-Content-Type-Options' => 'nosniff']);
        }

        return new PartyStatementResource(['statement' => $releve, 'party_id' => $partie->id, 'name' => $partie->displayName, 'currency' => $devise->getCode()]);
    }
}
