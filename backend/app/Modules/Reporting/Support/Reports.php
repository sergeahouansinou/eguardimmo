<?php

declare(strict_types=1);

namespace App\Modules\Reporting\Support;

use App\Modules\Reporting\Enums\ErrorCode;
use App\Modules\Reporting\Models\ManagementReport;
use Illuminate\Support\Str;

final class Reports
{
    /**
     * 404 `report_not_found` pour un compte rendu inconnu ou d'une autre organisation (le périmètre est posé par le modèle).
     */
    public function find(string $id): ManagementReport
    {
        return (Str::isUuid($id) ? ManagementReport::query()->whereKey($id)->first() : null) ?? throw ErrorCode::ReportNotFound->problem();
    }
}
