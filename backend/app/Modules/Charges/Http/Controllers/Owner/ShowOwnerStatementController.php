<?php

declare(strict_types=1);

namespace App\Modules\Charges\Http\Controllers\Owner;

use App\Modules\Charges\Http\Resources\OwnerStatementResource;
use App\Modules\Charges\Queries\OwnerStatements;
use App\Modules\Identity\Models\User;
use App\Modules\Mandates\PublicApi\MandateDirectory;
use App\Modules\Organizations\PublicApi\OrganizationDirectory;
use Illuminate\Http\Request;

final class ShowOwnerStatementController
{
    public function __invoke(string $statement, Request $request, MandateDirectory $mandats, OwnerStatements $decomptes, OrganizationDirectory $organisations): OwnerStatementResource
    {
        /** @var User $user */
        $user = $request->user();
        $d = $decomptes->get($mandats->ownerScope($user->id), $statement);

        return new OwnerStatementResource($d, $decomptes->lines(collect([$d])), $organisations->names([$d->organization_id])[$d->organization_id] ?? null);
    }
}
