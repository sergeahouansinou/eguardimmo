<?php

declare(strict_types=1);

namespace App\Modules\Documents\PublicApi;

use App\Modules\Documents\Actions\BuildBundle;
use App\Modules\Documents\Data\DocumentSubject;
use App\Modules\Documents\Data\GeneratedFile;
use App\Modules\Documents\Data\StoredFileData;
use Carbon\CarbonInterface;

final readonly class Bundles
{
    public function __construct(private BuildBundle $paquet) {}

    /**
     * Archive ZIP de fichiers stockés et de fichiers générés, stockée avec son empreinte SHA-256.
     *
     * @param  list<string>  $storedFileIds
     * @param  list<GeneratedFile>  $generated
     */
    public function zip(
        array $storedFileIds,
        array $generated,
        string $name,
        ?DocumentSubject $subject = null,
        ?CarbonInterface $retentionUntil = null,
    ): StoredFileData {
        return $this->paquet->handle($storedFileIds, $generated, $name, $subject, $retentionUntil);
    }
}
