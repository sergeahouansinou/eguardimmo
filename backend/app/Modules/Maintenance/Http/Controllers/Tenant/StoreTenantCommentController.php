<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Controllers\Tenant;

use App\Modules\Identity\Models\User;
use App\Modules\Maintenance\Actions\AddComment;
use App\Modules\Maintenance\Enums\ActorKind;
use App\Modules\Maintenance\Http\Requests\StoreTenantCommentRequest;
use App\Modules\Maintenance\Http\Support\TenantPresenter;
use App\Modules\Maintenance\Support\TenantAccess;
use Illuminate\Http\JsonResponse;

final class StoreTenantCommentController
{
    public function __invoke(string $intervention, StoreTenantCommentRequest $request, TenantAccess $acces, AddComment $action, TenantPresenter $presenter): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        $cible = $acces->intervention($user->id, $intervention);
        $acces->within($cible->organization_id, fn () => $action->handle($cible->id, ActorKind::Tenant, $request->text(), true, false));

        return $presenter->show($user->id, $cible->id)->response()->setStatusCode(201);
    }
}
