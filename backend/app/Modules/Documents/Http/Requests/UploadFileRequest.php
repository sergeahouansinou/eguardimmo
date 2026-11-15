<?php

declare(strict_types=1);

namespace App\Modules\Documents\Http\Requests;

use App\Modules\Documents\Data\DocumentSubject;
use App\Modules\Documents\Data\FileSource;
use App\Modules\Documents\Enums\FileCategory;
use App\Modules\Documents\Enums\SubjectType;
use App\Modules\Documents\Support\FileInspector;
use Carbon\CarbonImmutable;
use Closure;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\UploadedFile;
use Illuminate\Validation\Rule;

final class UploadFileRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, list<mixed>>
     */
    public function rules(): array
    {
        return [
            'file' => ['required', 'file', 'max:'.(FileCategory::Supporting->maxBytes() / 1024), $this->contenuAccepte(...)],
            'category' => ['nullable', 'string', Rule::in(FileCategory::uploadable())],
            'subject_type' => ['nullable', 'string', Rule::in(SubjectType::values()), 'required_with:subject_id'],
            'subject_id' => ['nullable', 'uuid', 'required_with:subject_type'],
            'retention_until' => ['nullable', 'date_format:Y-m-d', 'after:today'],
        ];
    }

    public function category(): FileCategory
    {
        return $this->filled('category') ? FileCategory::from((string) $this->validated('category')) : FileCategory::Supporting;
    }

    public function source(): FileSource
    {
        return FileSource::path((string) $this->file('file')?->getRealPath());
    }

    public function displayName(): string
    {
        return (string) $this->file('file')?->getClientOriginalName();
    }

    public function subject(): ?DocumentSubject
    {
        return $this->filled('subject_type') ? new DocumentSubject((string) $this->validated('subject_type'), (string) $this->validated('subject_id')) : null;
    }

    public function retentionUntil(): ?CarbonImmutable
    {
        return $this->filled('retention_until') ? CarbonImmutable::parse((string) $this->validated('retention_until'))->endOfDay() : null;
    }

    private function contenuAccepte(string $attribut, mixed $valeur, Closure $echec): void
    {
        $chemin = $valeur instanceof UploadedFile ? $valeur->getRealPath() : false;
        $probleme = $chemin === false ? null : FileInspector::problem($chemin, $this->category());

        if ($probleme !== null) {
            $echec($probleme->detail());
        }
    }
}
