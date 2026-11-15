<?php

declare(strict_types=1);

namespace App\Modules\Documents\Actions;

use App\Modules\Documents\Data\DocumentSubject;
use App\Modules\Documents\Data\FileSource;
use App\Modules\Documents\Data\StoredFileData;
use App\Modules\Documents\Enums\FileCategory;
use App\Modules\Documents\Support\StoredFileMapper;
use App\Modules\Documents\Support\StoredFileWriter;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;

final readonly class StoreFile
{
    public function __construct(private StoredFileWriter $ecriture) {}

    public function handle(
        FileSource $source,
        string $displayName,
        FileCategory $category,
        ?DocumentSubject $subject = null,
        ?CarbonInterface $retentionUntil = null,
    ): StoredFileData {
        return DB::transaction(fn (): StoredFileData => StoredFileMapper::data(
            $this->ecriture->write($source, $displayName, $category, $subject, $retentionUntil),
        ));
    }
}
