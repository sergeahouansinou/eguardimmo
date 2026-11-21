<?php

declare(strict_types=1);

namespace App\Modules\Inspections;

use App\Modules\Inspections\Http\Middleware\PrivateResponse;
use App\Modules\Inspections\Models\Inspection;
use App\Modules\Inspections\Models\InspectionRemark;
use App\Modules\Inspections\Models\InspectionRemarkFile;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Routing\Router;
use Illuminate\Support\ServiceProvider;

final class InspectionsServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        $this->app->make(Router::class)->aliasMiddleware('inspections.private', PrivateResponse::class);

        Relation::enforceMorphMap([
            'inspection' => Inspection::class,
            'inspection_remark' => InspectionRemark::class,
            'inspection_remark_file' => InspectionRemarkFile::class,
        ]);
    }
}
