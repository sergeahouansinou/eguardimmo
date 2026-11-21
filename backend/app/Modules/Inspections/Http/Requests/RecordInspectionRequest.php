<?php

declare(strict_types=1);

namespace App\Modules\Inspections\Http\Requests;

use App\Modules\Documents\Enums\FileCategory;
use App\Modules\Inspections\Data\NewInspectionData;
use App\Modules\Inspections\Enums\InspectionKind;
use App\Modules\Inspections\Enums\InspectionPerformer;
use App\Modules\Inspections\Support\ReadsSignatories;
use Carbon\CarbonImmutable;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\UploadedFile;
use Illuminate\Validation\Rule;

final class RecordInspectionRequest extends FormRequest
{
    use ReadsSignatories;

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
            'file' => ['required', 'file', 'mimes:pdf', 'max:'.(int) (FileCategory::Supporting->maxBytes() / 1024)],
            'kind' => ['required', 'string', Rule::enum(InspectionKind::class)],
            'performed_on' => ['required', 'date_format:Y-m-d', 'before_or_equal:today', 'after_or_equal:2000-01-01'],
            'performed_by' => ['required', 'string', Rule::enum(InspectionPerformer::class)],
            'exit_matches_entry' => ['nullable', 'boolean', 'prohibited_if:kind,entry'],
            'client_id' => ['required', 'uuid'],
            ...$this->signatoryRules(),
        ];
    }

    public function uploaded(): UploadedFile
    {
        $fichier = $this->file('file');

        return $fichier instanceof UploadedFile ? $fichier : throw new \LogicException('Fichier validé absent.');
    }

    public function toData(): NewInspectionData
    {
        return new NewInspectionData(
            InspectionKind::from((string) $this->validated('kind')),
            CarbonImmutable::parse((string) $this->validated('performed_on'))->startOfDay(),
            InspectionPerformer::from((string) $this->validated('performed_by')),
            $this->signatories(),
            $this->filled('exit_matches_entry') ? $this->boolean('exit_matches_entry') : null,
            (string) $this->validated('client_id'),
        );
    }
}
