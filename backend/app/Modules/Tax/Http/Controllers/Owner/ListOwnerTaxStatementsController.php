<?php

declare(strict_types=1);

namespace App\Modules\Tax\Http\Controllers\Owner;

use App\Modules\Identity\Models\User;
use App\Modules\Mandates\PublicApi\MandateDirectory;
use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use App\Modules\Tax\Http\Requests\ListOwnerTaxStatementsRequest;
use App\Modules\Tax\Http\Resources\OwnerTaxStatementResource;
use App\Modules\Tax\Models\TaxSummary;
use App\Modules\Tax\Queries\OwnerTaxStatements;
use Illuminate\Http\JsonResponse;

final class ListOwnerTaxStatementsController
{
    public function __invoke(ListOwnerTaxStatementsRequest $requete, MandateDirectory $mandats, OwnerTaxStatements $releves, OrganizationDirectory $organisations): JsonResponse
    {
        /** @var User $user */
        $user = $requete->user();
        $portee = $mandats->ownerScope($user->id, $requete->agency());
        $annee = $requete->filled('income_year') ? $requete->integer('income_year') : null;
        $page = $releves->listing($portee, $annee)->cursorPaginate($requete->perPage());
        $noms = $organisations->names(array_values(array_unique(array_map(fn (TaxSummary $s): string => $s->organization_id, $page->items()))));

        return response()->json([
            'data' => array_map(fn (TaxSummary $s): array => (new OwnerTaxStatementResource(['summary' => $s, 'agency_name' => $noms[$s->organization_id] ?? null, 'detail' => false]))->toArray($requete), array_values($page->items())),
            'meta' => ['next_cursor' => $page->nextCursor()?->encode(), 'per_page' => $page->perPage()],
        ]);
    }
}
