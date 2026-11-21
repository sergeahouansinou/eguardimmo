<?php

declare(strict_types=1);

namespace App\Modules\Documents\Actions;

use App\Modules\Documents\Enums\ErrorCode;
use App\Modules\Documents\Models\StoredFile;
use App\Shared\Audit\RecordAudit;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

final readonly class PurgeFile
{
    public function __construct(private RecordAudit $audit) {}

    public function handle(string $id, bool $early = false): void
    {
        DB::transaction(function () use ($id, $early): void {
            $fichier = Str::isUuid($id) ? StoredFile::query()->whereKey($id)->lockForUpdate()->first() : null;

            if ($fichier === null) {
                return;
            }

            if ($early && ! $fichier->allowsEarlyPurge()) {
                throw ErrorCode::EarlyPurgeRefused->problem();
            }

            if (! $early && ($fichier->retention_until === null || $fichier->retention_until->isFuture())) {
                throw ErrorCode::RetentionActive->problem();
            }

            $this->audit->handle('documents.file.purged', subject: $fichier, metadata: ['category' => $fichier->category->value, 'size_bytes' => $fichier->size_bytes, 'early' => $early]);
            $disque = Storage::disk($fichier->disk);
            $chemin = $fichier->path;
            $early ? StoredFile::query()->whereKey($fichier->id)->toBase()->delete() : $fichier->delete();
            DB::afterCommit(fn (): bool => $disque->delete($chemin));
        });
    }
}
