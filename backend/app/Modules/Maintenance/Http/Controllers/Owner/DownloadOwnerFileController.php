<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Controllers\Owner;

use App\Modules\Documents\PublicApi\DocumentStore;
use App\Modules\Identity\Models\User;
use App\Modules\Maintenance\Enums\ErrorCode;
use App\Modules\Maintenance\Models\InterventionFile;
use App\Modules\Maintenance\Queries\OwnerInterventions;
use App\Modules\Mandates\PublicApi\MandateDirectory;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class DownloadOwnerFileController
{
    public function __invoke(string $intervention, string $file, Request $request, MandateDirectory $mandats, OwnerInterventions $interventions, DocumentStore $documents, CurrentOrganization $contexte): StreamedResponse
    {
        /** @var User $user */
        $user = $request->user();
        $cible = $interventions->find($mandats->ownerScope($user->id), $intervention) ?? throw ErrorCode::OwnerInterventionNotFound->problem();

        return $contexte->run($cible->organization_id, function () use ($cible, $file, $documents): StreamedResponse {
            $ligne = Str::isUuid($file) ? InterventionFile::query()->whereKey($file)->where('intervention_id', $cible->id)->where('visible_to_owner', true)->first() : null;

            return $documents->stream(($ligne ?? throw ErrorCode::OwnerFileNotFound->problem())->stored_file_id);
        });
    }
}
