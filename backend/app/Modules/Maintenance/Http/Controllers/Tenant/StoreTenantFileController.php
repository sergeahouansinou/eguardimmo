<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Controllers\Tenant;

use App\Modules\Identity\Models\User;
use App\Modules\Maintenance\Actions\UploadInterventionFile;
use App\Modules\Maintenance\Enums\ActorKind;
use App\Modules\Maintenance\Enums\FileKind;
use App\Modules\Maintenance\Http\Requests\UploadTenantFileRequest;
use App\Modules\Maintenance\Http\Support\TenantPresenter;
use App\Modules\Maintenance\Support\TenantAccess;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\UploadedFile;

final class StoreTenantFileController
{
    public function __invoke(string $intervention, UploadTenantFileRequest $request, TenantAccess $acces, UploadInterventionFile $action, TenantPresenter $presenter): JsonResponse
    {
        /** @var User $user */
        $user = $request->user();
        /** @var UploadedFile $fichier */
        $fichier = $request->file('file');
        $cible = $acces->intervention($user->id, $intervention);
        $acces->within($cible->organization_id, fn () => $action->handle($cible->id, $fichier, FileKind::PhotoBefore, ActorKind::Tenant, true, false));

        return $presenter->show($user->id, $cible->id)->response()->setStatusCode(201);
    }
}
