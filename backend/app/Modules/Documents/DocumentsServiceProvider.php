<?php

declare(strict_types=1);

namespace App\Modules\Documents;

use App\Modules\Documents\Console\FlagCertificateDeadlinesCommand;
use App\Modules\Documents\Console\RescanUnverifiableCommand;
use App\Modules\Documents\Console\SweepOrphanFilesCommand;
use App\Modules\Documents\Models\Certificate;
use App\Modules\Documents\Models\IssuedDocument;
use App\Modules\Documents\Models\LibraryDocument;
use App\Modules\Documents\Models\StoredFile;
use App\Modules\Documents\Support\CertificateTypes;
use App\Modules\Documents\Support\MalwareScanner;
use App\Modules\Documents\Support\ScannerDriver;
use Illuminate\Database\Eloquent\Relations\Relation;
use Illuminate\Support\ServiceProvider;

final class DocumentsServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->scoped(CertificateTypes::class);
        $this->app->bind(MalwareScanner::class, fn (): MalwareScanner => ScannerDriver::make(
            config('documents.malware.scanner'),
            $this->app->isProduction(),
            (string) config('documents.malware.clamd_socket'),
            (int) config('documents.malware.timeout_seconds'),
        ));
    }

    public function boot(): void
    {
        if (! $this->commandeDeBuild()) {
            ScannerDriver::assertBootable(config('documents.malware.scanner'), $this->app->isProduction());
        }

        Relation::enforceMorphMap([
            'stored_file' => StoredFile::class,
            'issued_document' => IssuedDocument::class,
            'certificate' => Certificate::class,
            'library_document' => LibraryDocument::class,
        ]);

        if ($this->app->runningInConsole()) {
            $this->commands([SweepOrphanFilesCommand::class, FlagCertificateDeadlinesCommand::class, RescanUnverifiableCommand::class]);
        }
    }

    private function commandeDeBuild(): bool
    {
        $commande = $_SERVER['argv'][1] ?? '';

        return $this->app->runningInConsole() && in_array($commande, ['package:discover', 'config:cache', 'config:clear', 'optimize', 'optimize:clear', 'route:cache', 'view:cache', 'event:cache', 'key:generate'], true);
    }
}
