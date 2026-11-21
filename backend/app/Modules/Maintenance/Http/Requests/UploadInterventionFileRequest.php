<?php

declare(strict_types=1);

namespace App\Modules\Maintenance\Http\Requests;

use App\Modules\Maintenance\Enums\FileKind;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class UploadInterventionFileRequest extends FormRequest
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
            'file' => ['required', 'file', 'max:10240'],
            'kind' => ['required', Rule::enum(FileKind::class)],
            'visible_to_tenant' => ['nullable', 'boolean'],
            'visible_to_owner' => ['nullable', 'boolean'],
        ];
    }

    public function kind(): FileKind
    {
        return FileKind::from((string) $this->validated('kind'));
    }

    public function visibleToTenant(): bool
    {
        return (bool) ($this->validated('visible_to_tenant') ?? false);
    }

    public function visibleToOwner(): bool
    {
        return (bool) ($this->validated('visible_to_owner') ?? false);
    }
}
