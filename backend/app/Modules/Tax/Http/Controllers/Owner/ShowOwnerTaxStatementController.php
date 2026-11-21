<?php

declare(strict_types=1);

namespace App\Modules\Tax\Http\Controllers\Owner;

use App\Modules\Identity\Models\User;
use App\Modules\Mandates\PublicApi\MandateDirectory;
use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Modules\Tax\Enums\ErrorCode;
use App\Modules\Tax\Http\Resources\OwnerTaxStatementResource;
use App\Modules\Tax\Queries\OwnerTaxStatements;
use Illuminate\Http\Request;

final class ShowOwnerTaxStatementController
{
    public function __invoke(string $statement, Request $requete, MandateDirectory $mandats, OwnerTaxStatements $releves, OrganizationDirectory $organisations): OwnerTaxStatementResource
    {
        /** @var User $user */
        $user = $requete->user();
        $synthese = $releves->find($mandats->ownerScope($user->id), $statement) ?? throw ErrorCode::SummaryNotFound->problem();

        return new OwnerTaxStatementResource(['summary' => $synthese, 'agency_name' => $organisations->names([$synthese->organization_id])[$synthese->organization_id] ?? null, 'detail' => true]);
    }
}
