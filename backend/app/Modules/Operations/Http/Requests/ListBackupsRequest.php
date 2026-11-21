<?php

declare(strict_types=1);

namespace App\Modules\Operations\Http\Requests;

use App\Modules\Operations\Enums\BackupKind;
use App\Shared\Http\PaginatesWithCursor;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class ListBackupsRequest extends FormRequest
{
    use PaginatesWithCursor;

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
            ...$this->paginationRules(['id' => 'uuid']),
            'kind' => ['nullable', 'string', Rule::enum(BackupKind::class)],
            'succeeded' => ['nullable', 'boolean'],
        ];
    }

    public function kind(): ?BackupKind
    {
        return $this->filled('kind') ? BackupKind::from((string) $this->validated('kind')) : null;
    }

    public function succeeded(): ?bool
    {
        return $this->has('succeeded') && $this->input('succeeded') !== null ? $this->boolean('succeeded') : null;
    }

    public function cursor(): ?string
    {
        return $this->filled('cursor') ? (string) $this->validated('cursor') : null;
    }
}
