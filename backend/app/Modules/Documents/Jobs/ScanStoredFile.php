<?php

declare(strict_types=1);

namespace App\Modules\Documents\Jobs;

use App\Modules\Documents\Actions\ScanFile;
use App\Shared\Tenancy\CurrentOrganization;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;

/**
 * Analyse antivirale d'un fichier déposé, en file, sous le contexte de son organisation. Rejouable.
 */
final class ScanStoredFile implements ShouldQueue
{
    use Dispatchable;
    use Queueable;

    public int $tries = 3;

    public function __construct(
        public readonly string $organizationId,
        public readonly string $fileId,
    ) {}

    /**
     * @return list<int>
     */
    public function backoff(): array
    {
        return [60, 300];
    }

    public function handle(CurrentOrganization $organisation, ScanFile $analyse): void
    {
        $organisation->run($this->organizationId, fn () => $analyse->handle($this->fileId));
    }
}
