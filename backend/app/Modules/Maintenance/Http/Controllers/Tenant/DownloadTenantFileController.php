<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Controllers\Tenant;

use App\Modules\Documents\PublicApi\DocumentStore;
use App\Modules\Identity\Models\User;
use App\Modules\Maintenance\Enums\ErrorCode;
use App\Modules\Maintenance\Models\InterventionFile;
use App\Modules\Maintenance\Support\TenantAccess;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class DownloadTenantFileController
{
    public function __invoke(Request $request, string $intervention, string $file, TenantAccess $acces, DocumentStore $documents): StreamedResponse
    {
        /** @var User $user */
        $user = $request->user();
        $cible = $acces->intervention($user->id, $intervention);

        return $acces->within($cible->organization_id, function () use ($cible, $file, $documents): StreamedResponse {
            $ligne = Str::isUuid($file) ? InterventionFile::query()->whereKey($file)->where('intervention_id', $cible->id)->where('visible_to_tenant', true)->first() : null;

            return $documents->stream(($ligne ?? throw ErrorCode::FileNotFound->problem())->stored_file_id);
        });
    }
}
