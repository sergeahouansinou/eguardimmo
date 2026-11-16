<?php

declare(strict_types=1);

namespace App\Modules\Documents;

use App\Modules\Documents\Console\SweepOrphanFilesCommand;
use App\Modules\Documents\Models\Certificate;
use App\Modules\Documents\Models\IssuedDocument;
use App\Modules\Documents\Models\StoredFile;
use App\Modules\Documents\Support\CertificateTypes;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Support\ServiceProvider;

final class DocumentsServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->scoped(CertificateTypes::class);
    }

    public function boot(): void
    {
        Relation::enforceMorphMap([
            'stored_file' => StoredFile::class,
            'issued_document' => IssuedDocument::class,
            'certificate' => Certificate::class,
        ]);

        if ($this->app->runningInConsole()) {
            $this->commands([SweepOrphanFilesCommand::class]);
        }
    }
}
