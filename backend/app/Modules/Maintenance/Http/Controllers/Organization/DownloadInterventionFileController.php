<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Controllers\Organization;

use App\Modules\Documents\PublicApi\DocumentStore;
use App\Modules\Maintenance\Enums\ErrorCode;
use App\Modules\Maintenance\Models\InterventionFile;
use App\Modules\Maintenance\Queries\Interventions;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class DownloadInterventionFileController
{
    public function __invoke(string $intervention, string $file, Interventions $interventions, DocumentStore $documents): StreamedResponse
    {
        $interventions->get($intervention);
        $ligne = Str::isUuid($file) ? InterventionFile::query()->whereKey($file)->where('intervention_id', $intervention)->first() : null;

        return $documents->stream(($ligne ?? throw ErrorCode::FileNotFound->problem())->stored_file_id);
    }
}
