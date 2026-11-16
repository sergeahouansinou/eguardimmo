<?php

declare(strict_types=1);

namespace App\Modules\Documents\Actions;

use App\Modules\Documents\Data\IssuedDocumentData;
use App\Modules\Documents\Data\NewIssuedDocumentData;
use App\Modules\Documents\Enums\FileCategory;
use App\Modules\Documents\Models\IssuedDocument;
use App\Modules\Documents\Support\DocumentSequence;
use App\Modules\Documents\Support\StoredFileMapper;
use App\Modules\Documents\Support\StoredFileWriter;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

final readonly class IssueDocument
{
    public function __construct(
        private StoredFileWriter $ecriture,
        private DocumentSequence $sequences,
    ) {}

    public function handle(NewIssuedDocumentData $data): IssuedDocumentData
    {
        if ($data->snapshot === []) {
            throw new InvalidArgumentException('Une pièce émise porte toujours son instantané.');
        }

        return DB::transaction(function () use ($data): IssuedDocumentData {
            $fichier = $this->ecriture->write($data->pdf, $data->displayName, FileCategory::Issued, $data->subject, $data->retentionUntil);
            $sequence = $this->sequences->next($data->type);

            $piece = IssuedDocument::query()->create([
                'type' => $data->type,
                'sequence' => $sequence,
                'number' => $data->type->number($sequence),
                'snapshot' => $data->snapshot,
                'template_version' => $data->templateVersion,
                'stored_file_id' => $fichier->id,
                'fingerprint' => $fichier->sha256,
                'subject_type' => $data->subject?->type,
                'subject_id' => $data->subject?->id,
                'issued_at' => now(),
                'issued_by_user_id' => is_string(auth()->id()) ? auth()->id() : null,
            ]);

            return new IssuedDocumentData(
                $piece->id,
                $piece->type,
                $piece->sequence,
                $piece->number,
                $piece->snapshot,
                $piece->template_version,
                $piece->fingerprint,
                StoredFileMapper::data($fichier),
                $data->subject,
                CarbonImmutable::instance($piece->issued_at),
            );
        });
    }
}
