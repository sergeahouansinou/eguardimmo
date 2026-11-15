<?php

declare(strict_types=1);

namespace App\Modules\Documents\Actions;

use App\Modules\Documents\Data\DocumentSubject;
use App\Modules\Documents\Data\FileSource;
use App\Modules\Documents\Data\StoredFileData;
use App\Modules\Documents\Enums\FileCategory;
use App\Modules\Documents\Support\SubjectGuard;
use Carbon\CarbonInterface;

final readonly class UploadFile
{
    public function __construct(
        private SubjectGuard $sujets,
        private StoreFile $stockage,
    ) {}

    public function handle(
        FileSource $source,
        string $displayName,
        FileCategory $category,
        ?DocumentSubject $subject,
        ?CarbonInterface $retentionUntil,
    ): StoredFileData {
        if ($subject !== null) {
            $this->sujets->ensure($subject);
        }

        return $this->stockage->handle($source, $displayName, $category, $subject, $retentionUntil);
    }
}
