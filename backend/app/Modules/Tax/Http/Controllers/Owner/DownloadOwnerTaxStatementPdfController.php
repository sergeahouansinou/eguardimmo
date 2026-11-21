<?php

declare(strict_types=1);

namespace App\Modules\Tax\Http\Controllers\Owner;

use App\Modules\Identity\Models\User;
use App\Modules\Mandates\PublicApi\MandateDirectory;
use App\Modules\Tax\Enums\ErrorCode;
use App\Modules\Tax\Queries\OwnerTaxStatements;
use App\Modules\Tax\Support\SummaryDownloads;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class DownloadOwnerTaxStatementPdfController
{
    public function __invoke(string $statement, Request $requete, MandateDirectory $mandats, OwnerTaxStatements $releves, SummaryDownloads $telechargements, CurrentOrganization $contexte): StreamedResponse
    {
        /** @var User $user */
        $user = $requete->user();
        $synthese = $releves->find($mandats->ownerScope($user->id), $statement) ?? throw ErrorCode::SummaryNotFound->problem();

        return $contexte->run($synthese->organization_id, fn (): StreamedResponse => $telechargements->pdf($synthese));
    }
}
